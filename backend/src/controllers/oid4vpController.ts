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
import { oid4vpService } from '../services/oid4vpService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getVerifierRecord,
  getVerifierDidUrl,
  BPJS_PRESENTATION_DEFINITION,
} from '../credo-verifier.js';

export const oid4vpController = {
  /**
   * POST /api/verify/start
   * Start a new OID4VP verification session.
   * Returns QR code URL for the wallet to scan.
   */
  async startVerification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      console.log('🚀 Starting OID4VP verification...');

      const result = await oid4vpService.startVerification();

      res.status(201).json({
        success: true,
        message: 'OID4VP verification session created',
        data: {
          verificationId: result.verificationId,
          requestUri: result.requestUri,
          deepLink: result.deepLink,
          qrUrl: result.qrUrl,
          sessionId: result.sessionId,
          expiresAt: result.expiresAt,
          /** state — gunakan untuk /status/:state dan /request/:state */
          state: result.state,
          /** nonce — embed ke Authorization Request, dicek saat terima VP */
          nonce: result.nonce,
          presentationDefinition: BPJS_PRESENTATION_DEFINITION,
        },
      });
    } catch (error) {
      console.error('❌ Failed to start verification:', error);
      next(
        error instanceof AppError
          ? error
          : new AppError(
              `Failed to start verification: ${error instanceof Error ? error.message : 'Unknown error'}`,
              500
            )
      );
    }
  },

  /**
   * GET /api/verify/result/:sessionId
   * Poll for verification result.
   * Frontend calls this every 2 seconds.
   */
  async getResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;

      if (!sessionId) {
        throw new AppError('Session ID is required', 400, 'BAD_REQUEST');
      }

      if (!isUuid(sessionId)) {
        throw new AppError('Session ID format is invalid', 400, 'BAD_REQUEST');
      }

      const result = await oid4vpService.getVerificationResult(sessionId);

      res.json({
        success: true,
        message: `Verification status: ${result.status}`,
        data: {
          status: result.status,
          claims: result.claims,
          holderDid: result.holderDid,
          error: result.error,
          reasonCodes: result.reasonCodes,
          verificationDetails: result.verificationDetails,
          completedAt: result.completedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Verification session not found') {
        next(new AppError('Verification session not found', 404));
      } else {
        next(error);
      }
    }
  },

  /**
   * GET /api/verify/sessions
   * List all verification sessions (admin).
   */
  async getSessions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (Number.isNaN(page) || page < 1) {
        throw new AppError('Query parameter "page" must be a positive integer', 400, 'BAD_REQUEST');
      }
      if (Number.isNaN(limit) || limit < 1 || limit > 100) {
        throw new AppError('Query parameter "limit" must be between 1 and 100', 400, 'BAD_REQUEST');
      }

      const result = await oid4vpService.getSessions(page, limit);

      res.json({
        success: true,
        message: 'Verification sessions retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/verify/info
   * Get verifier configuration info.
   */
  async getInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const verifier = getVerifierRecord();
      const didUrl = getVerifierDidUrl();

      res.json({
        success: true,
        message: 'Verifier info retrieved',
        data: {
          verifierId: verifier.verifierId,
          didUrl: didUrl,
          clientMetadata: verifier.clientMetadata,
          presentationDefinition: BPJS_PRESENTATION_DEFINITION,
          supportedFormats: ['jwt_vc', 'jwt_vp', 'jwt_vc_json', 'vc+sd-jwt'],
          protocol: 'OID4VP v1',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/verify/request/:state
   * Step 2 MD: Wallet fetch Request Object sesuai request_uri pattern.
   * Mengembalikan Authorization Request info (QR URL, nonce, status).
   */
  async getRequestObject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const state = req.params.state as string;
      if (!state) throw new AppError('State parameter is required', 400);

      const session = await oid4vpService.getSessionByState(state);
      if (!session) throw new AppError('Sesi verifikasi tidak ditemukan', 404);

      if (session.expiresAt < new Date()) {
        await oid4vpService.markExpired(session.id);
        throw new AppError('Sesi verifikasi sudah kadaluarsa', 410);
      }

      res.json({
        success: true,
        message: 'Authorization Request retrieved',
        data: {
          state: session.state,
          nonce: session.nonce,
          qrUrl: session.qrUrl,
          status: session.status,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // handleVPCallback removed as Credo handles it internally via /authorization-response

  /**
   * GET /api/verify/status/:state
   * Step 5 MD: Frontend polling status sesi berdasarkan state token.
   * Alternatif dari /result/:sessionId.
   */
  async getVerificationStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const state = req.params.state as string;
      if (!state) throw new AppError('State parameter is required', 400);

      const result = await oid4vpService.getVerificationStatusByState(state);

      res.json({
        success: true,
        message: `Verification status: ${result.status}`,
        data: {
          status: result.status,
          // Hanya kirim claims jika COMPLETED/SUCCESS
          claims: result.status === 'SUCCESS' ? result.claims : null,
          holderDid: result.holderDid,
          error: result.error,
          reasonCodes: result.reasonCodes,
          verificationDetails: result.verificationDetails,
          completedAt: result.completedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Verification session not found') {
        next(new AppError('Sesi verifikasi tidak ditemukan', 404));
      } else {
        next(error);
      }
    }
  },
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapCredoErrorToReasonCode(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('nonce') || m.includes('missing nonce')) return 'missing_nonce';
  if (m.includes('jti')) return 'jti_mismatch';
  if (m.includes('credential') || m.includes('presentation_submission') || m.includes('descriptor')) return 'invalid_credential';
  if (m.includes('invalid_state')) return 'invalid_state';
  if (m.includes('session_expired')) return 'session_expired';
  if (m.includes('session_already_used')) return 'session_already_used';
  return 'cryptographic_verification_failed';
}
