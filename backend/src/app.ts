import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config/index.js';
import { authRoutes, verificationRoutes, didRoutes, issuerRoutes, oid4vpRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { didController } from './controllers/didController.js';
import { oid4vpController } from './controllers/oid4vpController.js';
import { oid4vpService } from './services/oid4vpService.js';
import { BPJS_PRESENTATION_DEFINITION } from './credo-verifier.js';
import { verifyPresentation, VPValidationError, mapStepToReasonCode } from './services/vpValidatorService.js';
import { sendError, sendSuccess } from './utils/apiResponse.js';
import {
  apiLimiter,
  authLimiter,
  hppProtection,
  sanitizeInputs,
  xssHeaders,
  validateRequestSize,
  securityLogger,
  contentSecurityPolicy,
} from './middleware/security.js';

// Create Express app
const app: Application = express();
app.set('trust proxy', true);

// Security middleware - OWASP Top 10 2025 Protection
app.use(helmet({
  contentSecurityPolicy: contentSecurityPolicy,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS configuration (must be early to handle preflight requests)
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
  })
);

// CORS preflight is handled automatically by the cors() middleware above

// Body parsing middleware (must be before sanitization)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging: method, path, status, duration, reasonCodes
app.use((req, res, next) => {
  const start = Date.now();

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const payload = body as Record<string, unknown> | undefined;
    const topReasonCodes = payload?.reasonCodes;
    const nestedReasonCodes = (payload?.data as Record<string, unknown> | undefined)?.reasonCodes;

    if (Array.isArray(topReasonCodes)) {
      (res.locals as Record<string, unknown>).reasonCodes = topReasonCodes;
    } else if (Array.isArray(nestedReasonCodes)) {
      (res.locals as Record<string, unknown>).reasonCodes = nestedReasonCodes;
    }

    return originalJson(body as any);
  }) as typeof res.json;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const localReasonCodes = (res.locals as Record<string, unknown>).reasonCodes;
    const reasonCodes = Array.isArray(localReasonCodes) ? localReasonCodes : [];

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        reasonCodes,
      })
    );
  });

  next();
});

// Additional security headers
app.use(xssHeaders);

// HTTP Parameter Pollution protection
app.use(hppProtection);

// Request size validation
app.use(validateRequestSize);

// Input sanitization - protects against SQL injection and XSS
app.use(sanitizeInputs);

// Security audit logger
app.use(securityLogger);

// Rate limiting - apply to all API requests
app.use('/api/', apiLimiter);

// Serve static files from public directory (for DID Document)
app.use(express.static(path.join(process.cwd(), 'public')));

// DID Document endpoint (standard .well-known location)
app.get('/.well-known/did.json', didController.getDIDDocument);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  sendSuccess(
    res,
    'Server is running',
    {
      service: 'verifier-backend',
      environment: config.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    200
  );
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  sendSuccess(res, 'Verifier API', {
    service: 'verifier-backend',
    version: '1.0.0',
    baseUrl: config.oid4vp.verifierBaseUrl,
    endpointGroups: {
      core: ['/health', '/api/verify/start', '/api/verify/result/:id', '/oid4vp/...'],
      supporting: ['/api', '/api/verify/info', '/api/verify/sessions', '/api/did/document'],
      optionalOrDeprecated: ['/api/verification/*', '/api/issuer/*'],
    },
    endpoints: {
      auth: '/api/auth',
      verification: '/api/verification',
      did: '/api/did',
      issuer: '/api/issuer',
      oid4vp: '/api/verify',
    },
  });
});

// OID4VP namespace root info
app.get('/oid4vp', (req: Request, res: Response) => {
  sendSuccess(res, 'OID4VP namespace', {
    protocolBase: '/oid4vp',
    description: 'OID4VP protocol endpoints are managed by Credo verifier app.',
    callback: '/oid4vp/callback',
  });
});

// Direct-post callback is now handled directly by Credo API via its built-in authorization-response endpoint

// Guard unknown OID4VP paths so they always return JSON
// NOTE: Patterns include all Credo-generated endpoints:
//   /oid4vp/{verifierId}/authorization-requests/{requestId}  → request_uri fetch
//   /oid4vp/{verifierId}/authorization-response              → direct_post callback
//   /oid4vp/{verifierId}/authorize                           → some OID4VP clients use this
app.use((req: Request, res: Response, next) => {
  if (!req.path.startsWith('/oid4vp/')) {
    return next();
  }

  const allowedPatterns = [
    /^\/oid4vp\/[\w-]+\/authorization-requests\/[0-9a-fA-F-]+$/,  // request_uri fetch
    /^\/oid4vp\/[\w-]+\/authorization-response$/,                   // direct_post
    /^\/oid4vp\/[\w-]+\/authorize/,                                 // OID4VP authorize (some clients)
    /^\/oid4vp\/[\w-]+\/openid-configuration$/,                     // metadata
    /^\/oid4vp\/[\w-]+\/jwks$/,                                     // JWKS
  ];

  if (allowedPatterns.some((pattern) => pattern.test(req.path))) {
    return next();
  }

  return sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/did', didRoutes);
app.use('/api/issuer', issuerRoutes);
app.use('/api/verify', oid4vpRoutes);

// JSON fallback for unknown API routes (never return HTML)
app.use('/api', (req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
});

// NOTE: 404 and error handlers are registered AFTER Credo app mount
// via finalizeApp() — called from index.ts after credo init

/**
 * Mount the Credo OID4VP Express app at root
 * Credo internally mounts its verifier routes at /oid4vp (basePath derived from
 * its own baseUrl config). Mounting at '/' here avoids double-prefixing:
 * if we mount at '/oid4vp', Express strips that prefix before passing to credoApp,
 * but credoApp already expects the full '/oid4vp/...' path internally.
 * Must be called after Credo agent is initialized, BEFORE finalizeApp()
 */
export function mountCredoApp(credoApp: import('express').Express): void {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/oid4vp')) {
      return next();
    }

    const requestObjectMatch = /^\/oid4vp\/[\w-]+\/authorization-requests\/([0-9a-fA-F-]+)$/.exec(req.path);
    if (req.method === 'GET' && requestObjectMatch) {
      const requestId = requestObjectMatch[1];
      const patchedJwt = oid4vpService.getHostedAuthorizationRequestJwt(requestId);
      if (patchedJwt) {
        return res.type('application/oauth-authz-req+jwt').status(200).send(patchedJwt);
      }
    }

    const isAuthorizationResponse =
      /^\/oid4vp\/[\w-]+\/authorization-response$/.test(req.path)
      || /^\/oid4vp\/[\w-]+\/authorize$/.test(req.path);
    if (req.method === 'POST' && isAuthorizationResponse) {
      oid4vpService.inspectIncomingAuthorizationResponse(req.body)
        .then(async (inspection) => {
          console.log('OID4VP incoming VP inspection:', JSON.stringify(inspection));
          if (!inspection.ok) {
              return sendError(
                res,
                400,
                'BAD_REQUEST',
                'invalid_request',
                {
                  reason: {
                    step: 'pre_validation',
                    detail: `VP pre-validation failed: ${inspection.issues.join(', ')}`,
                  },
                  reasonCodes: inspection.issues,
                },
              );
          }

          const body = req.body as Record<string, unknown>;
          const state = typeof body.state === 'string' ? body.state : null;
          const vpToken = typeof body.vp_token === 'string' ? body.vp_token : null;
          const presentationSubmission = body.presentation_submission;

          if (!state || !vpToken) {
            return sendError(
              res,
              400,
              'BAD_REQUEST',
              'invalid_request',
              {
                reason: {
                  step: 'request_validation',
                  detail: 'authorization-response wajib memiliki state dan vp_token',
                },
                reasonCodes: ['invalid_request'],
              },
            );
          }

          const session = await oid4vpService.getSessionByState(state);
          if (!session) {
            return sendError(
              res,
              400,
              'BAD_REQUEST',
              'invalid_request',
              {
                reason: {
                  step: 'session_lookup',
                  detail: `Sesi tidak ditemukan untuk state=${state}`,
                },
                reasonCodes: ['invalid_state'],
              },
            );
          }

          if (!session.nonce) {
            await oid4vpService.markFailed(session.id, 'Nonce sesi tidak tersedia', ['invalid_nonce']);
            return sendError(
              res,
              400,
              'BAD_REQUEST',
              'invalid_request',
              {
                reason: {
                  step: 'session_nonce',
                  detail: 'Nonce sesi tidak tersedia',
                },
                reasonCodes: ['invalid_nonce'],
              },
            );
          }

          try {
            const verified = await verifyPresentation(
              vpToken,
              session.nonce,
              presentationSubmission,
              BPJS_PRESENTATION_DEFINITION,
            );

            await oid4vpService.markSuccess(
              session.id,
              verified.claims,
              verified.claims.holderDID ?? null,
              vpToken,
              {
                step: 'manual_verification',
                detail: config.oid4vp.bypassCredoVerification
                  ? 'VP diverifikasi manual sebelum Credo callback'
                  : 'VP diverifikasi manual dan diterima tanpa override Credo',
                outcome: verified.outcome,
              },
            );

            return sendSuccess(
              res,
              'authorization_response_accepted',
              {
                status: 'SUCCESS',
                sessionId: session.id,
                reason: {
                  step: 'manual_verification',
                  detail: 'VP berhasil diverifikasi (signature, issuer trust, nonce, dan presentation definition valid)',
                },
                verificationDetails: verified.outcome,
              },
              200,
            );
          } catch (error) {
            const step = error instanceof VPValidationError ? error.step ?? 'verification' : 'verification';
            const detail = error instanceof Error ? error.message : 'Unknown verification error';
            const reasonCode = mapStepToReasonCode(step, detail);

            await oid4vpService.markFailed(session.id, detail, [reasonCode]);

            return sendError(
              res,
              400,
              'BAD_REQUEST',
              'invalid_request',
              {
                reason: {
                  step,
                  detail,
                },
                reasonCodes: [reasonCode],
              },
            );
          }

          credoApp(req, res, (err?: unknown) => {
            if (err) return next(err);
            if (!res.headersSent) return sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
          });
        })
        .catch((error) => next(error));
      return;
    }

    credoApp(req, res, (err?: unknown) => {
      if (err) {
        return next(err);
      }

      if (!res.headersSent) {
        return sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
      }
    });
  });
  console.log('  📡 Credo OID4VP Express app mounted at /');
}

/**
 * Finalize app by adding 404 and error handlers
 * Must be called AFTER mountCredoApp() to ensure proper route order
 */
export function finalizeApp(): void {
  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);
}

export default app;
