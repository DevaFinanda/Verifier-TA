/**
 * OID4VP Verifier API Service
 *
 * Backend endpoints (http://202.155.132.71:3002):
 *   POST /api/verify/start            → create session, returns QR URL
 *   GET  /api/verify/result/:sessionId → poll result (PENDING|SUCCESS|FAILED|EXPIRED)
 *
 * OID4VP flow:
 *   Step 1  startVerification()         → verifier creates Authorization Request
 *   Step 2  QR displayed to holder
 *   Step 3  Holder scans, wallet sends VP to backend callback
 *   Step 4  pollVerificationResult()    → waits until status !== PENDING
 *
 * Polling Strategy:
 *   - Uses recursive setTimeout (NOT setInterval) to prevent overlapping requests
 *   - Implements exponential backoff on 429 (Too Many Requests)
 *   - Stops immediately on terminal statuses: SUCCESS, FAILED, EXPIRED
 *   - Gracefully handles network errors, 5xx, and malformed responses
 *   - Cap max delay at 30 seconds to prevent indefinite wait
 *
 * Future Improvement (SSE / WebSocket):
 *   To eliminate polling entirely, consider replacing this with Server-Sent Events:
 *
 *   Backend (Express):
 *     router.get('/stream/:sessionId', (req, res) => {
 *       res.setHeader('Content-Type', 'text/event-stream');
 *       res.setHeader('Cache-Control', 'no-cache');
 *       res.setHeader('Connection', 'keep-alive');
 *       const interval = setInterval(async () => {
 *         const result = await oid4vpService.getVerificationResult(req.params.sessionId);
 *         res.write(`data: ${JSON.stringify(result)}\n\n`);
 *         if (result.status !== 'PENDING') { clearInterval(interval); res.end(); }
 *       }, 3000);
 *       req.on('close', () => clearInterval(interval));
 *     });
 *
 *   Frontend:
 *     const source = new EventSource(`${API_BASE_URL}/api/verify/stream/${sessionId}`);
 *     source.onmessage = (e) => { const result = JSON.parse(e.data); ... };
 *     source.onerror = () => { source.close(); };
 */

import { StartVerificationResponse, VerificationResult } from '@/types/verifier';

// Priority: env var from .env.local, fallback to production server
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_VERIFIER_API_URL ||
  'http://202.155.132.71:3002';

// ─── Polling Configuration ────────────────────────────────────────────────────

/**
 * Initial poll interval in ms.
 * 3 seconds is a safe baseline: at 3s intervals with a 15-min window = 300 requests,
 * well within the server's 100-req/15-min limit per IP.
 * Keeping it at 3–5s to reduce load while still feeling responsive.
 */
const POLL_INTERVAL_MS  = 3_000;  // Starting delay between polls (3 seconds)
const POLL_BACKOFF_MULT = 1.5;    // Multiply delay by this factor on 429 or 5xx
const POLL_MAX_DELAY_MS = 30_000; // Never wait longer than 30 seconds between polls
const POLL_TIMEOUT_MS   = 120_000; // Hard timeout: 2 minutes total

/** Statuses that signal a completed verification (polling should stop). */
const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'EXPIRED']);

// ─── Error Class ─────────────────────────────────────────────────────────────

export class VerifierApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'VerifierApiError';
  }
}

// ─── Core API Calls ──────────────────────────────────────────────────────────

/**
 * Step 1 — Create OID4VP verification session.
 * Calls POST /api/verify/start (no body required).
 * Backend generates an Authorization Request and returns a QR URL
 * (openid4vp://…) for the holder wallet to scan.
 */
export async function startVerification(): Promise<StartVerificationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new VerifierApiError(
        `Failed to start verification: ${response.statusText}`,
        response.status,
      );
    }

    const json = await response.json();
    // Backend wraps data in { success, message, data }
    const data: StartVerificationResponse = json?.data ?? json;
    console.log('[OID4VP] Verification session created:', data.sessionId);
    return data;
  } catch (err) {
    if (err instanceof VerifierApiError) throw err;
    throw new VerifierApiError(
      `Failed to start verification: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

/**
 * Step 4 — Get current verification result for a session.
 * Calls GET /api/verify/result/:sessionId.
 * Returns status: PENDING | SUCCESS | FAILED | EXPIRED
 *
 * Throws VerifierApiError with statusCode set for 429 so the caller
 * can detect rate-limiting and apply backoff.
 */
export async function getVerificationResult(sessionId: string): Promise<VerificationResult> {
  const response = await fetch(`${API_BASE_URL}/api/verify/result/${sessionId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // Ensure browser doesn't cache polling responses
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new VerifierApiError(
      `[${response.status}] Failed to get verification result: ${response.statusText}`,
      response.status,
    );
  }

  // Guard against malformed responses
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new VerifierApiError('Server returned a non-JSON response', 502);
  }

  if (typeof json !== 'object' || json === null) {
    throw new VerifierApiError('Malformed response: expected JSON object', 502);
  }

  const data = (json as Record<string, unknown>)?.data ?? json;
  return data as VerificationResult;
}

// ─── Robust Polling ──────────────────────────────────────────────────────────

/**
 * Poll for a terminal verification result (not PENDING).
 *
 * Key design decisions:
 * 1. Recursive setTimeout instead of setInterval — each poll only starts AFTER
 *    the previous response has been fully received, eliminating request overlap.
 * 2. Exponential backoff on 429 — multiplies the current delay by POLL_BACKOFF_MULT,
 *    capped at POLL_MAX_DELAY_MS, to progressively back off under rate limiting.
 * 3. Immediate stop on terminal statuses — once backend returns SUCCESS, FAILED,
 *    or EXPIRED, no further requests are made.
 * 4. Abort controller — calling the returned cancel() function cancels in-flight
 *    requests and stops the polling loop cleanly.
 * 5. Hard timeout — rejects if no terminal result is received within POLL_TIMEOUT_MS.
 *
 * @param sessionId    The session ID returned from startVerification()
 * @param onUpdate     Optional callback fired on every successful poll (including PENDING)
 * @param timeoutMs    Override the default 2-minute hard timeout
 * @returns            Promise<VerificationResult> — resolves with terminal result
 */
export function pollVerificationResult(
  sessionId: string,
  onUpdate?: (result: VerificationResult) => void,
  timeoutMs?: number,
): {
  promise: Promise<VerificationResult>;
  cancel: () => void;
} {
  const effectiveTimeout = timeoutMs ?? POLL_TIMEOUT_MS;
  const deadline = Date.now() + effectiveTimeout;

  let cancelled = false;
  let currentDelay = POLL_INTERVAL_MS;
  let currentTimer: ReturnType<typeof setTimeout> | null = null;
  let resolvePromise!: (result: VerificationResult) => void;
  let rejectPromise!: (err: VerifierApiError) => void;
  let consecutiveNetworkErrors = 0;

  // Hard deadline timer — fires if polling hasn't resolved before timeout
  const deadlineTimer = setTimeout(() => {
    if (!cancelled) {
      cancel();
      rejectPromise(
        new VerifierApiError('Verification timeout: No terminal result before session expiry'),
      );
    }
  }, effectiveTimeout);

  /**
   * cancel() — stop all pending timers and mark the loop as done.
   * Safe to call multiple times.
   */
  function cancel(): void {
    cancelled = true;
    if (currentTimer !== null) {
      clearTimeout(currentTimer);
      currentTimer = null;
    }
    clearTimeout(deadlineTimer);
  }

  /**
   * scheduleNext() — queue the next poll after `delay` ms.
   * Uses setTimeout so the next request doesn't fire until this one finishes.
   */
  function scheduleNext(delay: number): void {
    if (cancelled) return;

    // Ensure we never wait past the deadline
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      cancel();
      rejectPromise(
        new VerifierApiError('Verification timeout: Deadline exceeded without terminal result'),
      );
      return;
    }

    const safeDelay = Math.min(delay, remainingMs);
    currentTimer = setTimeout(doPoll, safeDelay);
  }

  /**
   * doPoll() — execute a single polling request.
   * On success: invoke onUpdate, check for terminal status, or schedule next poll.
   * On 429: apply exponential backoff.
   * On 5xx / network error: retry up to 3 times before giving up.
   */
  async function doPoll(): Promise<void> {
    if (cancelled) return;

    try {
      const result = await getVerificationResult(sessionId);
      consecutiveNetworkErrors = 0; // Reset error streak on success

      // Notify caller of intermediate state (e.g. to update loading UI)
      onUpdate?.(result);

      if (TERMINAL_STATUSES.has(result.status)) {
        // ✅ Terminal state reached — stop polling and resolve
        cancel();
        resolvePromise(result);
        return;
      }

      // Still PENDING — schedule next poll at current (normal) delay
      console.log(
        `[OID4VP] Status: ${result.status} — next poll in ${currentDelay / 1000}s`,
      );
      scheduleNext(currentDelay);
    } catch (err) {
      if (cancelled) return;

      const statusCode = err instanceof VerifierApiError ? err.statusCode : undefined;

      // ── 429 Too Many Requests ── apply exponential backoff
      if (statusCode === 429) {
        const newDelay = Math.min(currentDelay * POLL_BACKOFF_MULT, POLL_MAX_DELAY_MS);
        console.warn(
          `[OID4VP] 429 Rate Limited — backing off from ${currentDelay}ms to ${newDelay}ms`,
        );
        currentDelay = newDelay;
        scheduleNext(currentDelay);
        return;
      }

      // ── 404 Not Found ── session doesn't exist, stop immediately
      if (statusCode === 404) {
        cancel();
        rejectPromise(
          new VerifierApiError('Verification session not found. It may have expired.', 404),
        );
        return;
      }

      // ── 5xx Server Error or Network error ── retry up to 3 times
      consecutiveNetworkErrors++;
      const isRecoverable = !statusCode || statusCode >= 500;
      if (isRecoverable && consecutiveNetworkErrors <= 3) {
        const retryDelay = Math.min(currentDelay * POLL_BACKOFF_MULT, POLL_MAX_DELAY_MS);
        console.warn(
          `[OID4VP] Error (${statusCode ?? 'network'}) — retry ${consecutiveNetworkErrors}/3 in ${retryDelay}ms`,
          err,
        );
        scheduleNext(retryDelay);
        return;
      }

      // ── Non-recoverable or too many errors ── give up
      cancel();
      rejectPromise(
        err instanceof VerifierApiError
          ? err
          : new VerifierApiError(
              `Verification polling failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            ),
      );
    }
  }

  const promise = new Promise<VerificationResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
    // Kick off the first poll after the initial interval
    scheduleNext(currentDelay);
  });

  return { promise, cancel };
}

/** Backward-compat alias — VerificationDashboard uses this name */
export const generatePresentationRequest = startVerification;

// ─── History / Sessions ───────────────────────────────────────────────────────

export interface VerificationSession {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  requestedAt: string;
  completedAt: string | null;
  holderDid: string | null;
  disclosedClaims: Record<string, unknown> | null;
  error: string | null;
  expiresAt: string;
}

export interface SessionsResponse {
  sessions: VerificationSession[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Get paginated list of all OID4VP verification sessions.
 * Calls GET /api/verify/sessions?page=&limit=
 */
export async function getSessions(
  page: number = 1,
  limit: number = 20,
): Promise<SessionsResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(
    `${API_BASE_URL}/api/verify/sessions?page=${page}&limit=${limit}`,
    { headers },
  );

  if (!response.ok) {
    throw new VerifierApiError(
      `Failed to fetch sessions: ${response.statusText}`,
      response.status,
    );
  }

  const json = await response.json();
  return (json?.data ?? json) as SessionsResponse;
}

/**
 * Delete a verification session from history.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/api/verify/sessions/${sessionId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new VerifierApiError(
      `Failed to delete session: ${response.statusText}`,
      response.status,
    );
  }
}
