import { sendError } from '../utils/apiResponse.js';
export class AppError extends Error {
    statusCode;
    isOperational;
    code;
    details;
    constructor(message, statusCode, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
export const errorHandler = (err, req, res, next) => {
    // If headers already sent, delegate to default Express handler
    if (res.headersSent) {
        return next(err);
    }
    if (err instanceof AppError) {
        const mappedCode = err.code ?? mapStatusToCode(err.statusCode);
        sendError(res, err.statusCode, mappedCode, err.message, err.details);
        return;
    }
    // Handle body-parser JSON parse errors → 400 Bad Request
    if (err.type === 'entity.parse.failed' || (err.statusCode === 400 && err.expose === true)) {
        sendError(res, 400, 'BAD_REQUEST', 'Invalid JSON in request body');
        return;
    }
    console.error('Error:', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', process.env.NODE_ENV === 'development' ? { details: { error: err?.message ?? String(err) } } : undefined);
};
export const notFoundHandler = (req, res, next) => {
    if (res.headersSent) {
        return;
    }
    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
};
function mapStatusToCode(status) {
    if (status === 400)
        return 'BAD_REQUEST';
    if (status === 401)
        return 'UNAUTHORIZED';
    if (status === 403)
        return 'FORBIDDEN';
    if (status === 404)
        return 'NOT_FOUND';
    if (status === 409)
        return 'CONFLICT';
    if (status === 422)
        return 'UNPROCESSABLE_ENTITY';
    if (status === 429)
        return 'TOO_MANY_REQUESTS';
    return 'INTERNAL_ERROR';
}
//# sourceMappingURL=errorHandler.js.map