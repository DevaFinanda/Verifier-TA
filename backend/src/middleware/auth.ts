import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { JWTPayload } from '../types/index.js';
import { sendError } from '../utils/apiResponse.js';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 401, 'UNAUTHORIZED', 'Access denied. No token provided.');
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = decoded;
    next();
  } catch (error) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token.');
  }
};

export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      req.user = decoded;
    }

    next();
  } catch (error) {
    next();
  }
};
