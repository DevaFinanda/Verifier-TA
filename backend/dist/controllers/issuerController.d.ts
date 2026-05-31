import { Request, Response, NextFunction } from 'express';
export declare const issuerController: {
    /**
     * Get all trusted issuers status
     */
    getIssuers(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resolve single issuer and fetch public key
     */
    resolveIssuer(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resolve all trusted issuers
     */
    resolveAllIssuers(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify credential signature
     */
    verifySignature(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=issuerController.d.ts.map