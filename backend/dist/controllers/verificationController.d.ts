import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const verificationController: {
    /**
     * Create a new verification request (generate QR code)
     */
    createRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get verification request status
     */
    getRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Simulate QR code scan
     */
    simulateScan(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Complete verification and get patient data
     * Requires credential from holder
     */
    completeVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get verification history
     */
    getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get verification log detail
     */
    getLogDetail(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get verification stats
     */
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=verificationController.d.ts.map