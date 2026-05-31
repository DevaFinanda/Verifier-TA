/**
 * OID4VP Verifier — Type definitions
 *
 * Matches the actual backend API contract at /api/verify/*
 */

// ─── Step 1 response — POST /api/verify/start ────────────────────────────────

export interface StartVerificationResponse {
  /** openid4vp://… URI encoded in the QR code */
  qrUrl: string;
  /** Unique session ID; pass to getVerificationResult() */
  sessionId: string;
  /** ISO-8601 expiry time (default: ~2 min from creation) */
  expiresAt: string;
  /** Opaque state token — untuk /status/:state polling dan /request/:state */
  state: string;
  /** Per-session nonce — anti-replay, digunakan di VP callback validation */
  nonce: string;
  /** Presentation Definition sent to the wallet (informational) */
  presentationDefinition?: unknown;
}

// ─── Step 4 response — GET /api/verify/result/:sessionId ─────────────────────

/** Disclosed credential claims from a successful VP */
export interface CredentialClaims {
  /** Holder full name */
  holderName?: string;
  /** Alias — some wallets send 'nama' */
  nama?: string;
  /** National ID number */
  nik?: string;
  /** Date of birth (ISO-8601 or 'YYYY-MM-DD') */
  tanggalLahir?: string;
  /** Alias — older wallets use 'tanggal_lahir' */
  tanggal_lahir?: string;
  /** BPJS membership number */
  noBPJS?: string;
  noBpjs?: string;
  /** Membership status (e.g. 'Aktif') */
  statusKepesertaan?: string;
  /** Membership valid until date */
  tglAkhirKepesertaan?: string;
  /** Allow additional fields from the credential */
  [key: string]: unknown;
}

export interface VerificationResultPending {
  status: 'PENDING';
  claims: null;
  holderDid: null;
  error: null;
  reasonCodes?: string[];
  verificationDetails?: Record<string, unknown> | null;
  completedAt: null;
}

export interface VerificationResultSuccess {
  status: 'SUCCESS';
  claims: CredentialClaims;
  holderDid: string | null;
  error: null;
  reasonCodes?: string[];
  verificationDetails?: Record<string, unknown> | null;
  cryptographicVerified?: boolean;
  issuerTrusted?: boolean;
  statusValid?: boolean;
  claimValid?: boolean;
  overallVerified?: boolean;
  checks?: Array<{ name: string; passed: boolean; message: string }>;
  completedAt: string;
}

export interface VerificationResultFailed {
  status: 'FAILED';
  claims: null;
  holderDid: null;
  error: string;
  reasonCodes?: string[];
  verificationDetails?: Record<string, unknown> | null;
  cryptographicVerified?: boolean;
  issuerTrusted?: boolean;
  statusValid?: boolean;
  claimValid?: boolean;
  overallVerified?: boolean;
  checks?: Array<{ name: string; passed: boolean; message: string }>;
  completedAt: string | null;
}

export interface VerificationResultExpired {
  status: 'EXPIRED';
  claims: null;
  holderDid: null;
  error: string | null;
  reasonCodes?: string[];
  verificationDetails?: Record<string, unknown> | null;
  completedAt: string | null;
}

export type VerificationResult =
  | VerificationResultPending
  | VerificationResultSuccess
  | VerificationResultFailed
  | VerificationResultExpired;

// ─── UI State Machine ─────────────────────────────────────────────────────────

export type VerificationState =
  | 'idle'
  | 'loading'
  | 'qr_generated'
  | 'waiting_presentation'
  | 'verified'
  | 'failed'
  | 'expired';

// ─── Backward-compat alias (used by VerificationResult.tsx display) ───────────

/** @deprecated Use VerificationResultSuccess.claims instead */
export interface CredentialSubject {
  nik: string;
  nama: string;
  tanggal_lahir: string;
}
