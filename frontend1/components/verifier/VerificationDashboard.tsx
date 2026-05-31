'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QRDisplay } from './QRDisplay';
import { LoadingStatus } from './LoadingStatus';
import { VerificationResult } from './VerificationResult';
import {
  startVerification,
  pollVerificationResult,
  VerifierApiError,
} from '@/services/verifierApi';
import { VerificationState, VerificationResult as VerificationResultType } from '@/types/verifier';
import { Sparkles } from 'lucide-react';

export function VerificationDashboard() {
  // ── State machine ────────────────────────────────────────────────────────
  // idle → qr_generated → waiting_presentation → verified | failed | expired
  const [state, setState] = useState<VerificationState>('idle');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string>('');
  const [result, setResult] = useState<VerificationResultType | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Ref to the cancel() function returned by pollVerificationResult().
   * Calling it stops the recursive setTimeout loop and cancels the deadline timer.
   * This ref persists across re-renders without triggering re-renders itself.
   */
  const cancelPollRef = useRef<(() => void) | null>(null);

  // ── Polling effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'qr_generated' || !sessionId) return;

    setState('waiting_presentation');
    setError('');

    /**
     * Calculate dynamic timeout based on session expiry.
     * If expiresAt is known: wait until expiry + 2 s buffer minimum 5 s.
     * Fallback to the service default (2 minutes) if expiry is unavailable.
     */
    const timeoutMs = sessionExpiresAt
      ? Math.max(new Date(sessionExpiresAt).getTime() - Date.now() + 2_000, 5_000)
      : undefined;

    // Start the optimised recursive polling — returns { promise, cancel }
    const { promise, cancel } = pollVerificationResult(
      sessionId,
      // onUpdate: fired on every PENDING poll so we can reflect processing state
      (intermediate) => {
        console.log('[OID4VP] Intermediate status:', intermediate.status);
      },
      timeoutMs,
    );

    // Store cancel() so the cleanup function can abort polling on unmount
    cancelPollRef.current = cancel;

    promise
      .then((pollResult) => {
        if (pollResult.status === 'SUCCESS') {
          setState('verified');
          setResult(pollResult);
        } else if (pollResult.status === 'FAILED') {
          setState('failed');
          setResult(pollResult);
        } else if (pollResult.status === 'EXPIRED') {
          setState('expired');
          setResult(pollResult);
        }
      })
      .catch((err) => {
        // Detect timeout-style errors and show expired state
        if (err instanceof VerifierApiError && /timeout|deadline/i.test(err.message)) {
          setState('expired');
          setResult({
            status: 'EXPIRED',
            claims: null,
            holderDid: null,
            error: 'Session expired — please generate a new QR code.',
            reasonCodes: ['session_expired'],
            verificationDetails: null,
            completedAt: null,
          });
          return;
        }

        // All other errors
        if (err instanceof VerifierApiError) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred during verification');
        }
        setState('failed');
      })
      .finally(() => {
        cancelPollRef.current = null;
      });

    // Cleanup: cancel polling when component unmounts or sessionId changes
    return () => {
      cancel();
      cancelPollRef.current = null;
    };
  }, [state, sessionId, sessionExpiresAt]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Step 1 — Generate OID4VP Authorization Request.
   * Calls POST /api/verify/start, displays QR code, then triggers polling.
   */
  const handleGenerateQR = async () => {
    // Cancel any in-progress poll before starting a new session
    cancelPollRef.current?.();
    cancelPollRef.current = null;

    try {
      setIsLoading(true);
      setError('');
      setResult(null);

      const response = await startVerification();
      console.log('[OID4VP] Session started:', response.sessionId);

      // Step 2 — Show QR code  (qrUrl = openid4vp://… Authorization Request URI)
      setQrUrl(response.qrUrl);
      setSessionId(response.sessionId);
      setSessionExpiresAt(response.expiresAt);
      // Transition to qr_generated triggers the polling useEffect above
      setState('qr_generated');
    } catch (err) {
      if (err instanceof VerifierApiError) {
        setError(err.message);
      } else {
        setError('Failed to generate QR code. Please try again.');
      }
      setState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    // Always cancel any active poll before resetting to idle
    cancelPollRef.current?.();
    cancelPollRef.current = null;

    setState('idle');
    setQrUrl('');
    setSessionId('');
    setSessionExpiresAt('');
    setResult(null);
    setError('');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Identity Verifier</h1>
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Secure digital identity verification using verifiable credentials
          </p>
        </div>

        {/* Content */}
        {state === 'idle' && (
          <Card className="border-primary/20 bg-card/50 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground mb-6">
              Click the button below to start verifying identity credentials
            </p>
            <Button
              onClick={handleGenerateQR}
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Generating...' : 'Generate Verification QR'}
            </Button>
          </Card>
        )}

        {/* Step 3 — QR shown; holder scans with wallet */}
        {(state === 'qr_generated' || state === 'waiting_presentation') && (
          <>
            <QRDisplay
              qrUrl={qrUrl}
              requestId={sessionId}
              isWaiting={state === 'waiting_presentation'}
            />
          </>
        )}

        {/* Step 4 — VP submitted, backend verifying */}
        {state === 'waiting_presentation' && (
          <LoadingStatus
            message="Verifying Credentials"
            description="Verifiable Presentation received. Checking cryptographic signature…"
          />
        )}

        {/* Step 5 — Show result (SUCCESS or FAILED) */}
        {(state === 'verified' || state === 'failed') && result && (
          <VerificationResult result={result} onReset={handleReset} />
        )}

        {/* EXPIRED state */}
        {state === 'expired' && (
          <VerificationResult result={result!} onReset={handleReset} />
        )}

        {error && (
          <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20 p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </Card>
        )}

      </div>
    </div>
  );
}
