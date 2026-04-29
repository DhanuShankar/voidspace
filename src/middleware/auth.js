import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { unauthorized } from "../utils/response.js";

/**
 * JWT Token verification middleware
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, "No token provided");
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwt.secret);

    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return unauthorized(res, "Token expired");
    }
    if (error.name === "JsonWebTokenError") {
      return unauthorized(res, "Invalid token");
    }
    return unauthorized(res, "Authentication failed");
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      req.userId = decoded.userId;
    }
  } catch (error) {
    // Silently ignore errors for optional auth
  }

  next();
};

/**
 * Role-based access control
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res);
    }

    const hasRole = roles.includes(req.user.role) || roles.includes("*");

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};
