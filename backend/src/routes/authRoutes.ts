import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => {
  sendSuccess(res, 'Auth routes', {
    endpoints: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/profile', 'POST /api/auth/logout'],
  });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter, // Rate limiting for registration
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('fasikesName').notEmpty().withMessage('Fasikes name is required'),
  ],
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter, // Rate limiting for login - prevents brute force
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, authController.logout);

router.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

export default router;
