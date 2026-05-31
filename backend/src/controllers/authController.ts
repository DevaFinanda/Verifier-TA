import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services/authService.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const authController = {
  /**
   * Register a new user
   */
  async register(
    req: Request,
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

      const { email, password, name, fasikesName } = req.body;

      const result = await authService.register({
        email,
        password,
        name,
        fasikesName,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
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
   * Login user
   */
  async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      console.log('🔐 Login attempt received:', { email: req.body.email });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const result = await authService.login(email, password);
      
      console.log('✅ Login successful for:', email);

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      console.log('❌ Login error:', error);
      if (error instanceof Error) {
        next(new AppError(error.message, 401));
      } else {
        next(error);
      }
    }
  },

  /**
   * Get current user profile
   */
  async getProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Logout (client-side token removal)
   */
  async logout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // In a real application, you might want to blacklist the token
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};
