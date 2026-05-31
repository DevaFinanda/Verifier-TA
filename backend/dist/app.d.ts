import { Application } from 'express';
declare const app: Application;
/**
 * Mount the Credo OID4VP Express app at root
 * Credo internally mounts its verifier routes at /oid4vp (basePath derived from
 * its own baseUrl config). Mounting at '/' here avoids double-prefixing:
 * if we mount at '/oid4vp', Express strips that prefix before passing to credoApp,
 * but credoApp already expects the full '/oid4vp/...' path internally.
 * Must be called after Credo agent is initialized, BEFORE finalizeApp()
 */
export declare function mountCredoApp(credoApp: import('express').Express): void;
/**
 * Finalize app by adding 404 and error handlers
 * Must be called AFTER mountCredoApp() to ensure proper route order
 */
export declare function finalizeApp(): void;
export default app;
//# sourceMappingURL=app.d.ts.map