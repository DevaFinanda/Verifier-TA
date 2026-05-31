export const sendSuccess = (res, message, data, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data: data ?? null,
        timestamp: new Date().toISOString(),
    });
};
export const sendError = (res, statusCode, error, message, extras) => {
    const payload = {
        success: false,
        error,
        message,
        path: res.req?.originalUrl ?? res.req?.url,
        timestamp: new Date().toISOString(),
        ...(extras ?? {}),
    };
    const reasonCodes = payload.reasonCodes;
    if (Array.isArray(reasonCodes)) {
        res.locals.reasonCodes = reasonCodes;
    }
    return res.status(statusCode).json(payload);
};
//# sourceMappingURL=apiResponse.js.map