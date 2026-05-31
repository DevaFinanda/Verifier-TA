import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../types/index.js';
export interface AuthRequest extends Request {
    user?: JWTPayload;
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map