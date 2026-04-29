import { error as sendError } from "../utils/response.js";

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log error
  console.error(`[${req.method}] ${req.path}`, {
    error: err.message,
    stack: err.stack,
    userId: req.user?.userId,
    requestId: req.id,
  });

  // Handle known error types
  if (err.name === "ValidationError") {
    return sendError(res, { message: err.message, details: err.details }, 400);
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }

  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      success: false,
      error: "Invalid CSRF token",
    });
  }

  if (err.code === "LIMITER_REACHED") {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
    });
  }

  // Handle Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: "File too large",
      maxSize: "50MB",
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      error: "Unexpected file field",
    });
  }

  // Handle async errors
  if (err.statusCode) {
    return sendError(res, { message: err.message }, err.statusCode);
  }

  // Generic server error
  return sendError(res, { message: "Internal server error" });
};

/**
 * 404 handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
};
