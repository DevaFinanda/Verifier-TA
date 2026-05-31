import { Request, Response, NextFunction } from 'express';
import { didService } from '../services/didService.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const didController = {
  /**
   * Get DID Document (for .well-known/did.json)
   */
  async getDIDDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get DID configuration
   */
  async getConfig(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get endorsers (trust network)
   */
  async getEndorsers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const endorsers = didService.getEndorsers();

      res.json({
        success: true,
        message: 'Endorsers retrieved',
        data: endorsers,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get technical information
   */
  async getTechnicalInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const info = didService.getTechnicalInfo();

      res.json({
        success: true,
        message: 'Technical info retrieved',
        data: info,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resolve a DID
   */
  async resolveDID(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const did = req.body.did as string;

      const result = didService.resolveDID(did);

      if (!result) {
        throw new AppError('DID not found', 404);
      }

      res.json({
        success: true,
        message: 'DID resolved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify endorsement
   */
  async verifyEndorsement(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const endorserId = req.body.endorserId as string;

      const isVerified = didService.verifyEndorsement(endorserId);

      res.json({
        success: true,
        message: isVerified ? 'Endorsement verified' : 'Endorsement not verified',
        data: { verified: isVerified },
      });
    } catch (error) {
      next(error);
    }
  },
};
