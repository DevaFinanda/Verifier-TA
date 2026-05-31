/**
 * OID4VP Controller
 *
 * Handles all OID4VP verification endpoints:
 * - POST /api/verify/start       → Create VP Request, return QR URL
 * - GET  /api/verify/result/:id  → Poll verification result
 * - GET  /api/verify/sessions    → List all sessions (admin)
 * - GET  /api/verify/info        → Get verifier info (DID, config)
 */
import { Request, Response, NextFunction } from 'express';
export declare const oid4vpController: {
    /**
     * POST /api/verify/start
     * Start a new OID4VP verification session.
     * Returns QR code URL for the wallet to scan.
     */
    startVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/verify/result/:sessionId
     * Poll for verification result.
     * Frontend calls this every 2 seconds.
     */
    getResult(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/verify/sessions
     * List all verification sessions (admin).
     */
    getSessions(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/verify/info
     * Get verifier configuration info.
     */
    getInfo(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/verify/request/:state
     * Step 2 MD: Wallet fetch Request Object sesuai request_uri pattern.
     * Mengembalikan Authorization Request info (QR URL, nonce, status).
     */
    getRequestObject(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/verify/status/:state
     * Step 5 MD: Frontend polling status sesi berdasarkan state token.
     * Alternatif dari /result/:sessionId.
     */
    getVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=oid4vpController.d.ts.map