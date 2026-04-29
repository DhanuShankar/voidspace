import rateLimit from "express-rate-limit";
import config from "../config/index.js";
import { tooManyRequests } from "../utils/response.js";

/**
 * General rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
  handler: (req, res) => tooManyRequests(res),
});

/**
 * Strict rate limiter for auth endpoints (prevents brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: "Too many login attempts, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: (req, res) => tooManyRequests(res),
});

/**
 * File upload rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: { error: "Upload limit exceeded, please try again in an hour" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => tooManyRequests(res),
});

/**
 * API rate limiter with different limits per user type
 */
export const apiLimiter = (req, res, next) => {
  const user = req.user;

  if (user && user.plan === "enterprise") {
    return next(); // No limits for enterprise
  }

  if (user && user.plan === "pro") {
    // Pro users: 1000 requests per 15 min
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    });
    return limiter(req, res, next);
  }

  // Free users: use general limiter
  return generalLimiter(req, res, next);
};
