import { Request, Response, NextFunction } from 'express';
import { type ApiErrorCode } from '../utils/apiResponse.js';
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    code?: ApiErrorCode;
    details?: Record<string, unknown>;
    constructor(message: string, statusCode: number, code?: ApiErrorCode, details?: Record<string, unknown>);
}
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map