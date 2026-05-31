/**
 * OID4VP Routes
 *
 * Routes for OID4VP verification using Credo-TS.
 * These are separate from the legacy verification routes.
 */

import { Router } from 'express';
import { oid4vpController } from '../controllers/oid4vpController.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
import { pollLimiter } from '../middleware/security.js';

const router = Router();

router.get('/', (req, res) => {
	sendSuccess(res, 'OID4VP routes', {
		core: ['POST /api/verify/start', 'GET /api/verify/result/:sessionId'],
		supporting: ['GET /api/verify/info', 'GET /api/verify/sessions'],
		callbacks: ['POST /api/verify/callback', 'GET /api/verify/status/:state', 'GET /api/verify/request/:state'],
	});
});

/**
 * @route   POST /api/verify/start
 * @desc    Start a new OID4VP verification session (generate QR URL)
 * @access  Public
 */
router.post('/start', optionalAuth, oid4vpController.startVerification);

/**
 * @route   GET /api/verify/result/:sessionId
 * @desc    Poll verification result.
 *          Uses a dedicated pollLimiter (60 req/15 min) separate from the
 *          global apiLimiter, so polling doesn't exhaust the shared budget.
 *          Frontend uses exponential backoff if a 429 is returned.
 * @access  Public
 */
router.get('/result/:sessionId', pollLimiter, oid4vpController.getResult);

/**
 * @route   GET /api/verify/sessions
 * @desc    List all OID4VP verification sessions (admin)
 * @access  Public (optionalAuth)
 */
router.get('/sessions', optionalAuth, oid4vpController.getSessions);

/**
 * @route   GET /api/verify/info
 * @desc    Get verifier configuration info
 * @access  Public
 */
router.get('/info', oid4vpController.getInfo);

/**
 * @route   GET /api/verify/request/:state
 * @desc    Step 2 MD: Wallet fetch Authorization Request Object by state token
 * @access  Public
 */
router.get('/request/:state', oid4vpController.getRequestObject);

// Manual callback route has been removed. Credo handles /authorization-response internally.

/**
 * @route   GET /api/verify/status/:state
 * @desc    Step 5 MD: Poll verification status by state token (alternatif /result/:sessionId)
 * @access  Public
 */
router.get('/status/:state', oid4vpController.getVerificationStatus);

router.use((req, res) => {
	sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

export default router;
