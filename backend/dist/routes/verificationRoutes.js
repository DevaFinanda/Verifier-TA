import { Router } from 'express';
import { body } from 'express-validator';
import { verificationController } from '../controllers/verificationController.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
const router = Router();
router.get('/', (req, res) => {
    sendSuccess(res, 'Legacy verification routes', {
        deprecated: true,
        endpoints: [
            'POST /api/verification/request',
            'GET /api/verification/request/:requestId',
            'POST /api/verification/scan/:requestId',
            'POST /api/verification/complete/:requestId',
            'GET /api/verification/history',
            'GET /api/verification/log/:requestId',
            'GET /api/verification/stats',
        ],
    });
});
/**
 * @route   POST /api/verification/request
 * @desc    Create a new verification request (generate QR)
 * @access  Public (no auth required)
 */
router.post('/request', optionalAuth, [
    body('attributes')
        .isArray({ min: 1 })
        .withMessage('At least one attribute is required'),
], verificationController.createRequest);
/**
 * @route   GET /api/verification/request/:requestId
 * @desc    Get verification request status
 * @access  Public
 */
router.get('/request/:requestId', verificationController.getRequestStatus);
/**
 * @route   POST /api/verification/scan/:requestId
 * @desc    Simulate QR code scan
 * @access  Public
 */
router.post('/scan/:requestId', verificationController.simulateScan);
/**
 * @route   POST /api/verification/complete/:requestId
 * @desc    Complete verification and get patient data
 * @access  Public
 */
router.post('/complete/:requestId', [body('tujuanPoli').optional().isString()], verificationController.completeVerification);
/**
 * @route   GET /api/verification/history
 * @desc    Get verification history
 * @access  Private
 */
router.get('/history', optionalAuth, verificationController.getHistory);
/**
 * @route   GET /api/verification/log/:requestId
 * @desc    Get verification log detail
 * @access  Private
 */
router.get('/log/:requestId', authMiddleware, verificationController.getLogDetail);
/**
 * @route   GET /api/verification/stats
 * @desc    Get verification stats
 * @access  Private
 */
router.get('/stats', authMiddleware, verificationController.getStats);
router.use((req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});
export default router;
//# sourceMappingURL=verificationRoutes.js.map