import { Router } from 'express';
import { body } from 'express-validator';
import { didController } from '../controllers/didController.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => {
  sendSuccess(res, 'DID routes', {
    endpoints: [
      'GET /api/did/document',
      'GET /api/did/config',
      'GET /api/did/endorsers',
      'GET /api/did/technical',
      'POST /api/did/resolve',
      'POST /api/did/verify',
    ],
  });
});

/**
 * @route   GET /api/did/document
 * @desc    Get Verifier DID Document
 * @access  Public
 */
router.get('/document', didController.getDIDDocument);

/**
 * @route   GET /api/did/config
 * @desc    Get DID configuration
 * @access  Private
 */
router.get('/config', authMiddleware, didController.getConfig);

/**
 * @route   GET /api/did/endorsers
 * @desc    Get all endorsers
 * @access  Private
 */
router.get('/endorsers', authMiddleware, didController.getEndorsers);

/**
 * @route   GET /api/did/technical
 * @desc    Get technical info
 * @access  Private
 */
router.get('/technical', optionalAuth, didController.getTechnicalInfo);

/**
 * @route   POST /api/did/resolve
 * @desc    Resolve a DID
 * @access  Private
 */
router.post(
  '/resolve',
  authMiddleware,
  [body('did').isString().withMessage('DID is required')],
  didController.resolveDID
);

/**
 * @route   POST /api/did/verify
 * @desc    Verify an endorsement signature
 * @access  Private
 */
router.post(
  '/verify',
  authMiddleware,
  [
    body('endorserId').isString().withMessage('Endorser ID is required'),
    body('message').isString().withMessage('Message is required'),
    body('signature').isString().withMessage('Signature is required'),
  ],
  didController.verifyEndorsement
);

router.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

export default router;
