import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

const getClientIp = (req: Request): string => {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Security Middleware for OWASP Top 10 2025 Protection
 * Implements protections against:
 * - A01:2021 – Broken Access Control
 * - A03:2021 – Injection (SQL, XSS, etc.)
 * - A05:2021 – Security Misconfiguration
 * - A07:2021 – Identification and Authentication Failures
 */

/**
 * General API Rate Limiting Middleware
 * Prevents brute force attacks and DDoS
 * Limit: 300 requests per 15 minutes per IP
 * (Raised from 100 to accommodate legitimate OID4VP polling traffic)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Dedicated Rate Limiter for OID4VP Polling Endpoint
 * Applied specifically to GET /api/verify/result/:sessionId
 *
 * Budget: 60 requests per 15 minutes per IP.
 * With the new 3-second polling interval this allows ~1 active session
 * polling continuously for the full 15-min window (300s = 100 polls),
 * with headroom for retries and backoff.
 *
 * Response includes Retry-After header so the client can respect the limit.
 */
export const pollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 polls per 15 min ≈ 1 poll every 15s sustained
  message: {
    success: false,
    message: 'Polling rate limit reached. Please wait a moment before retrying.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Strict Rate Limiting for Authentication Routes
 * Limit: 5 requests per 15 minutes per IP
 * Prevents brute force login attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * HPP (HTTP Parameter Pollution) Protection
 * Prevents attacks like: ?id=1&id=2&id=3
 * Only allows last value for parameters
 */
export const hppProtection = hpp();

/**
 * SQL Injection Protection Middleware
 * Sanitizes request parameters, body, and query
 * Removes common SQL injection patterns
 */
export const sanitizeInputs = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove dangerous patterns but preserve normal quotes for JSON
      let sanitized = obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
        .replace(/<!--/g, '') // Remove HTML comments start
        .replace(/-->/g, ''); // Remove HTML comments end
      
      // Only trim, don't remove quotes as they're needed for JSON
      return sanitized.trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize body only (query and params are already safely parsed by Express)
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitize(req.body);
    }
  } catch (error) {
    console.error('Error sanitizing request body:', error);
  }

  next();
};

/**
 * XSS Protection Headers
 * Additional layer of XSS protection through headers
 */
export const xssHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
  next();
};

/**
 * Validate Request Size
 * Prevents payload too large attacks
 */
export const validateRequestSize = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = req.headers['content-length'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum size is 10MB.',
    });
    return;
  }

  next();
};

/**
 * Security Audit Logger
 * Logs suspicious activities
 */
export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const suspicious = [
    'union select',
    'drop table',
    'drop database',
    '<script',
    'javascript:',
    'onerror=',
    'onclick=',
  ];

  const checkForSuspicious = (obj: any): boolean => {
    if (typeof obj === 'string') {
      const lowerStr = obj.toLowerCase();
      return suspicious.some((pattern) => lowerStr.includes(pattern));
    } else if (Array.isArray(obj)) {
      return obj.some(checkForSuspicious);
    } else if (obj !== null && typeof obj === 'object') {
      return Object.values(obj).some(checkForSuspicious);
    }
    return false;
  };

  if (
    checkForSuspicious(req.body) ||
    checkForSuspicious(req.query) ||
    checkForSuspicious(req.params)
  ) {
    console.warn('⚠️ SECURITY ALERT: Suspicious request detected', {
      ip: getClientIp(req),
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Content Security Policy
 * Prevents XSS and data injection attacks
 */
export const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
};
