import { Request, Response, NextFunction } from 'express';
import { issuerResolverService } from '../services/issuerResolverService.js';
import { AppError } from '../middleware/errorHandler.js';

export const issuerController = {
  /**
   * Get all trusted issuers status
   */
  async getIssuers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const issuers = await issuerResolverService.getAllIssuersStatus();

      res.json({
        success: true,
        message: 'Trusted issuers retrieved',
        data: {
          count: issuers.length,
          issuers,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resolve single issuer and fetch public key
   */
  async resolveIssuer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const did = req.body.did as string;

      if (!did) {
        throw new AppError('DID is required', 400);
      }

      const issuerInfo = await issuerResolverService.resolveIssuer(did);

      if (!issuerInfo) {
        throw new AppError('Could not resolve issuer', 404);
      }

      res.json({
        success: true,
        message: 'Issuer resolved successfully',
        data: issuerInfo,
      });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(error.message, 400));
      } else {
        next(error);
      }
    }
  },

  /**
   * Resolve all trusted issuers
   */
  async resolveAllIssuers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await issuerResolverService.resolveAllIssuers();

      res.json({
        success: true,
        message: `Resolved ${results.length} issuers`,
        data: {
          resolved: results.length,
          total: (await issuerResolverService.getAllIssuersStatus()).length,
          issuers: results,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify credential signature
   */
  async verifySignature(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { did, signature } = req.body;

      if (!did || !signature) {
        throw new AppError('DID and signature are required', 400);
      }

      const isValid = await issuerResolverService.verifyCredentialSignature(
        did,
        signature
      );

      res.json({
        success: true,
        message: isValid ? 'Signature verified' : 'Signature invalid',
        data: {
          did,
          verified: isValid,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
