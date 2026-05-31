import { Router } from 'express';
import { body } from 'express-validator';
import { issuerController } from '../controllers/issuerController.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => {
  sendSuccess(res, 'Issuer routes', {
    endpoints: [
      'GET /api/issuer/list',
      'POST /api/issuer/resolve',
      'POST /api/issuer/resolve-all',
      'POST /api/issuer/verify-signature',
    ],
  });
});

/**
 * @route   GET /api/issuer/list
 * @desc    Get all trusted issuers
 * @access  Public
 */
router.get('/list', optionalAuth, issuerController.getIssuers);

/**
 * @route   POST /api/issuer/resolve
 * @desc    Resolve single issuer and fetch public key
 * @access  Public
 */
router.post(
  '/resolve',
  optionalAuth,
  [body('did').isString().withMessage('DID is required')],
  issuerController.resolveIssuer
);

/**
 * @route   POST /api/issuer/resolve-all
 * @desc    Resolve all trusted issuers
 * @access  Public
 */
router.post('/resolve-all', optionalAuth, issuerController.resolveAllIssuers);

/**
 * @route   POST /api/issuer/verify-signature
 * @desc    Verify credential signature with issuer public key
 * @access  Public
 */
router.post(
  '/verify-signature',
  optionalAuth,
  [
    body('did').isString().withMessage('DID is required'),
    body('signature').isString().withMessage('Signature is required'),
  ],
  issuerController.verifySignature
);

router.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

export default router;
