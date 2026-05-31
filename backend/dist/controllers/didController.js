import { didService } from '../services/didService.js';
import { AppError } from '../middleware/errorHandler.js';
export const didController = {
    /**
     * Get DID Document (for .well-known/did.json)
     */
    async getDIDDocument(req, res, next) {
        try {
            const didDocument = didService.getDIDDocument();
            if (didDocument.error) {
                res.status(503).json({
                    success: false,
                    error: didDocument.error,
                });
                return;
            }
            res.json(didDocument);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Get DID configuration
     */
    async getConfig(req, res, next) {
        try {
            const config = didService.getConfig();
            res.json({
                success: true,
                message: 'DID configuration retrieved',
                data: {
                    did: config.did,
                    publicKey: config.publicKey,
                    algorithm: config.algorithm,
                    status: config.status,
                    createdAt: config.createdAt,
                },
            });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Get endorsers (trust network)
     */
    async getEndorsers(req, res, next) {
        try {
            const endorsers = didService.getEndorsers();
            res.json({
                success: true,
                message: 'Endorsers retrieved',
                data: endorsers,
            });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Get technical information
     */
    async getTechnicalInfo(req, res, next) {
        try {
            const info = didService.getTechnicalInfo();
            res.json({
                success: true,
                message: 'Technical info retrieved',
                data: info,
            });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Resolve a DID
     */
    async resolveDID(req, res, next) {
        try {
            const did = req.body.did;
            const result = didService.resolveDID(did);
            if (!result) {
                throw new AppError('DID not found', 404);
            }
            res.json({
                success: true,
                message: 'DID resolved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * Verify endorsement
     */
    async verifyEndorsement(req, res, next) {
        try {
            const endorserId = req.body.endorserId;
            const isVerified = didService.verifyEndorsement(endorserId);
            res.json({
                success: true,
                message: isVerified ? 'Endorsement verified' : 'Endorsement not verified',
                data: { verified: isVerified },
            });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=didController.js.map