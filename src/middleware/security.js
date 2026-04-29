import cors from "cors";
import helmet from "helmet";
import config from "../config/index.js";

/**
 * CORS middleware
 */
export const corsMiddleware = cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  optionsSuccessStatus: 200,
  exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
});

/**
 * Security headers middleware
 */
export const securityMiddleware = helmet({
  contentSecurityPolicy: config.security.helmet.contentSecurityPolicy,
  crossOriginEmbedderPolicy: false,
});

/**
 * Request ID middleware for tracing
 */
export const requestIdMiddleware = (req, res, next) => {
  req.id = require("crypto").randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
};
