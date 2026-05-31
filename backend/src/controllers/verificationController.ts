import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { verificationService } from '../services/verificationService.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const verificationController = {
  /**
   * Create a new verification request (generate QR code)
   */
  async createRequest(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { attributes } = req.body;
      const verifierId = req.user?.userId || 'anonymous';

      const request = await verificationService.createRequest(verifierId, attributes);

      res.status(201).json({
        success: true,
        message: 'Verification request created',
        data: {
          requestId: request.requestId,
          qrData: request.qrData,
          timestamp: request.timestamp,
          attributes: request.attributes,
          status: request.status,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get verification request status
   */
  async getRequestStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestId = req.params.requestId as string;

      const request = await verificationService.getRequest(requestId);

      if (!request) {
        throw new AppError('Verification request not found', 404);
      }

      res.json({
        success: true,
        message: 'Request status retrieved',
        data: {
          requestId: request.requestId,
          status: request.status,
          timestamp: request.timestamp,
          attributes: request.attributes,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Simulate QR code scan
   */
  async simulateScan(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestId = req.params.requestId as string;

      const result = await verificationService.simulateScan(requestId);

      res.json({
        success: true,
        message: 'Scan simulated',
        data: {
          logs: result.logs,
          status: result.request.status,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(error.message, 404));
      } else {
        next(error);
      }
    }
  },

  /**
   * Complete verification and get patient data
   * Requires credential from holder
   */
  async completeVerification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestId = req.params.requestId as string;
      const { tujuanPoli, credential } = req.body;

      // ⚠️ credential is REQUIRED - comes from holder's wallet
      const result = await verificationService.completeVerification(
        requestId, 
        tujuanPoli,
        credential
      );

      const logs =
        result.status === 'success'
          ? [
              `$ [${new Date().toLocaleTimeString()}] ✓ Signature verified with Issuer public key!`,
              `$ [${new Date().toLocaleTimeString()}] ✓ Credential is valid and trusted!`,
              `$ [${new Date().toLocaleTimeString()}] ✓ Patient data verified and displayed.`,
            ]
          : [
              `$ [${new Date().toLocaleTimeString()}] ✗ Verification failed!`,
              `$ [${new Date().toLocaleTimeString()}] ${result.errorMessage}`,
              `$ [${new Date().toLocaleTimeString()}] ⚠️  Check: Is VPS online? Is Issuer accessible?`,
            ];

      res.json({
        success: result.status === 'success',
        message: result.status === 'success' ? 'Verification successful' : 'Verification failed',
        data: {
          ...result,
          logs,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(error.message, 404));
      } else {
        next(error);
      }
    }
  },

  /**
   * Get verification history
   */
  async getHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const verifierId = req.query.all === 'true' ? undefined : req.user?.userId;

      const result = await verificationService.getHistory(verifierId, page, limit);

      res.json({
        success: true,
        message: 'History retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get verification log detail
   */
  async getLogDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestId = req.params.requestId as string;

      const log = await verificationService.getLogByRequestId(requestId);

      if (!log) {
        throw new AppError('Log not found', 404);
      }

      res.json({
        success: true,
        message: 'Log detail retrieved',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get verification stats
   */
  async getStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await verificationService.getStats();

      res.json({
        success: true,
        message: 'Stats retrieved',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },
};
