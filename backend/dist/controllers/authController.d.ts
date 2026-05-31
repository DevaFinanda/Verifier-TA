import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const authController: {
    /**
     * Register a new user
     */
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Login user
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get current user profile
     */
    getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Logout (client-side token removal)
     */
    logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=authController.d.ts.map