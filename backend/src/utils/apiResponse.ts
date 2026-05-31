import { Response } from 'express';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_ERROR'
  | 'TOO_MANY_REQUESTS';

export const sendSuccess = (
  res: Response,
  message: string,
  data?: unknown,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    timestamp: new Date().toISOString(),
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  error: ApiErrorCode,
  message: string,
  extras?: Record<string, unknown>
): Response => {
  const payload: Record<string, unknown> = {
    success: false,
    error,
    message,
    path: res.req?.originalUrl ?? res.req?.url,
    timestamp: new Date().toISOString(),
    ...(extras ?? {}),
  };

  const reasonCodes = payload.reasonCodes;
  if (Array.isArray(reasonCodes)) {
    (res.locals as Record<string, unknown>).reasonCodes = reasonCodes;
  }

  return res.status(statusCode).json(payload);
};
