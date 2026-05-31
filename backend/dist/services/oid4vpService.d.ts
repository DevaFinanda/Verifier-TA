/**
 * OID4VP Verification Service
 *
 * Handles verification sessions using Credo-TS OID4VP module.
 * Manages session lifecycle: create â†’ poll â†’ complete.
 * Saves results to PostgreSQL for audit/history.
 */
export interface Oid4vpSession {
    id: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
    requestedAt: Date;
    completedAt: Date | null;
    holderDid: string | null;
    disclosedClaims: Record<string, unknown> | null;
    rawVpToken: string | null;
    error: string | null;
    expiresAt: Date;
    nonce: string | null;
    nonceExpiresAt: Date | null;
    state: string | null;
    usedAt: Date | null;
    reasonCodes: string[];
    verificationDetails: Record<string, unknown> | null;
    qrUrl: string | null;
}
export interface StartVerificationResult {
    verificationId: string;
    requestUri: string;
    deepLink: string;
    qrUrl: string;
    sessionId: string;
    expiresAt: Date;
    /** Generated per-session nonce â€” WAJIB dicek saat terima VP (anti-replay) */
    nonce: string;
    /** Opaque state token â€” digunakan untuk korelasi requestâ€“response dan status polling */
    state: string;
}
export interface VerificationResultData {
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
    claims: Record<string, unknown> | null;
    holderDid: string | null;
    error: string | null;
    reasonCodes: string[];
    verificationDetails: Record<string, unknown> | null;
    completedAt: Date | null;
}
export declare const oid4vpService: {
    /**
     * Start a new OID4VP verification session.
     * Creates an authorization request via Credo-TS and saves session to DB.
     */
    startVerification(): Promise<StartVerificationResult>;
    /**
     * Get the current result of a verification session.
     * Checks Credo-TS session state and syncs with DB.
     */
    getVerificationResult(sessionId: string): Promise<VerificationResultData>;
    /**
     * Get all verification sessions (for admin view).
     */
    getSessions(page?: number, limit?: number): Promise<{
        sessions: Oid4vpSession[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    /**
     * Save verification result to the legacy verification_logs table.
     */
    saveToVerificationLog(sessionId: string, claims: Record<string, unknown>): Promise<void>;
    /**
     * Cari sesi berdasarkan state token (untuk request_uri pattern & callback).
     */
    getSessionByState(state: string): Promise<{
        id: string;
        nonce: string | null;
        nonceExpiresAt: Date | null;
        status: string;
        expiresAt: Date;
        usedAt: Date | null;
        qrUrl: string | null;
        state: string;
    } | null>;
    /**
     * Poll status verifikasi berdasarkan state (alternatif dari /result/:sessionId).
     * Sesuai Step 5 MD: GET /api/verify/status/:state
     */
    getVerificationStatusByState(state: string): Promise<VerificationResultData>;
    getHostedAuthorizationRequestJwt(requestId: string): string | null;
    inspectIncomingAuthorizationResponse(payload: unknown): Promise<{
        ok: boolean;
        issues: string[];
        summary: Record<string, unknown> | null;
        expected?: {
            nonce: string | null;
            domain: string;
        };
    }>;
    /**
     * Tandai sesi sebagai SUCCESS setelah VP Token divalidasi manual.
     */
    markSuccess(sessionId: string, claims: Record<string, unknown>, holderDid: string | null, rawVpToken: string | null, verificationDetails?: Record<string, unknown>): Promise<void>;
    /**
     * Tandai sesi sebagai FAILED.
     */
    markFailed(sessionId: string, errorMsg: string, reasonCodes?: string[]): Promise<void>;
    /**
     * Tandai sesi sebagai EXPIRED.
     */
    markExpired(sessionId: string): Promise<void>;
};
//# sourceMappingURL=oid4vpService.d.ts.map