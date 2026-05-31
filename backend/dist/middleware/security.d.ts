import { Request, Response, NextFunction } from 'express';
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
export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
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
export declare const pollLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict Rate Limiting for Authentication Routes
 * Limit: 5 requests per 15 minutes per IP
 * Prevents brute force login attacks
 */
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * HPP (HTTP Parameter Pollution) Protection
 * Prevents attacks like: ?id=1&id=2&id=3
 * Only allows last value for parameters
 */
export declare const hppProtection: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * SQL Injection Protection Middleware
 * Sanitizes request parameters, body, and query
 * Removes common SQL injection patterns
 */
export declare const sanitizeInputs: (req: Request, res: Response, next: NextFunction) => void;
/**
 * XSS Protection Headers
 * Additional layer of XSS protection through headers
 */
export declare const xssHeaders: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validate Request Size
 * Prevents payload too large attacks
 */
export declare const validateRequestSize: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Security Audit Logger
 * Logs suspicious activities
 */
export declare const securityLogger: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Content Security Policy
 * Prevents XSS and data injection attacks
 */
export declare const contentSecurityPolicy: {
    directives: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        imgSrc: string[];
        connectSrc: string[];
        fontSrc: string[];
        objectSrc: string[];
        mediaSrc: string[];
        frameSrc: string[];
    };
};
//# sourceMappingURL=security.d.ts.map