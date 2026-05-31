import { Response } from 'express';
export type ApiErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE_ENTITY' | 'INTERNAL_ERROR' | 'TOO_MANY_REQUESTS';
export declare const sendSuccess: (res: Response, message: string, data?: unknown, statusCode?: number) => Response;
export declare const sendError: (res: Response, statusCode: number, error: ApiErrorCode, message: string, extras?: Record<string, unknown>) => Response;
//# sourceMappingURL=apiResponse.d.ts.map