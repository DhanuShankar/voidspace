/**
 * API Response helpers
 */

export const success = (res, data, statusCode = 200, message = null) => {
  const response = {
    success: true,
    ...(data && { data }),
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
};

export const created = (res, data, message = null) => success(res, data, 201, message);

export const error = (res, err, statusCode = 500) => {
  console.error(`[ERROR ${statusCode}]:`, err.message);

  const response = {
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  };

  if (err.code) response.code = err.code;
  if (err.details) response.details = err.details;

  return res.status(statusCode).json(response);
};

export const validationError = (res, errors) => {
  return error(res, { message: "Validation failed", details: errors }, 400);
};

export const unauthorized = (res, message = "Unauthorized") => error(res, { message }, 401);

export const forbidden = (res, message = "Forbidden") => error(res, { message }, 403);

export const notFound = (res, message = "Resource not found") => error(res, { message }, 404);

export const badRequest = (res, message = "Bad request") => error(res, { message }, 400);

export const conflict = (res, message = "Conflict") => error(res, { message }, 409);
