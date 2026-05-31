import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare const didController: {
    /**
     * Get DID Document (for .well-known/did.json)
     */
    getDIDDocument(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get DID configuration
     */
    getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get endorsers (trust network)
     */
    getEndorsers(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get technical information
     */
    getTechnicalInfo(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resolve a DID
     */
    resolveDID(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify endorsement
     */
    verifyEndorsement(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=didController.d.ts.map