import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import config from "../config/index.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { success, created, error } from "../utils/response.js";

const router = Router();

/**
 * In-memory user store (replace with database in production)
 */
const users = new Map();

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post("/signup", validate(schemas.signup), (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    for (const user of users.values()) {
      if (user.email === email) {
        return error(res, { message: "User already exists" }, 409);
      }
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return next(err);

      const userId = crypto.randomUUID();
      const user = {
        userId,
        email,
        password: hashedPassword,
        name,
        plan: "free",
        createdAt: new Date().toISOString(),
        colabQuota: 0,
        colabQuotaUsed: 0,
        preferences: {},
      };

      users.set(userId, user);

      const token = generateToken(userId);
      const refreshToken = generateRefreshToken();

      const { password: _, ...userWithoutPassword } = user;

      created(res, {
        user: userWithoutPassword,
        token,
        refreshToken,
      }, "Account created successfully");
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user
 * @access  Public
 */
router.post("/login", validate(schemas.login), (req, res, next) => {
  try {
    const { email, password } = req.body;

    let foundUser = null;
    for (const user of users.values()) {
      if (user.email === email) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return error(res, { message: "Invalid credentials" }, 401);
    }

    // Verify password
    bcrypt.compare(password, foundUser.password, (err, isMatch) => {
      if (err) return next(err);

      if (!isMatch) {
        return error(res, { message: "Invalid credentials" }, 401);
      }

      const token = generateToken(foundUser.userId);
      const refreshToken = generateRefreshToken();

      const { password: _, ...userWithoutPassword } = foundUser;

      success(res, {
        user: userWithoutPassword,
        token,
        refreshToken,
      }, 200, "Logged in successfully");
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get("/me", authenticate, (req, res, next) => {
  try {
    const user = users.get(req.userId);

    if (!user) {
      return error(res, { message: "User not found" }, 404);
    }

    const { password: _, ...userWithoutPassword } = user;
    success(res, userWithoutPassword);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, { message: "Refresh token required" }, 400);
    }

    // In production, validate refresh token against database
    // For now, issue new token
    const userId = req.userId || "temp-user"; // Would decode from refresh token

    const token = generateToken(userId);

    success(res, { token });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token)
 * @access  Private
 */
router.post("/logout", authenticate, (req, res, next) => {
  try {
    // In production, add token to blacklist or delete refresh token
    success(res, null, 200, "Logged out successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/auth/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get("/stats", authenticate, (req, res, next) => {
  try {
    const user = users.get(req.userId);

    if (!user) {
      return error(res, { message: "User not found" }, 404);
    }

    const stats = {
      userId: user.userId,
      plan: user.plan,
      colabQuotaUsed: user.colabQuotaUsed,
      colabQuota: user.colabQuota,
      filesCount: 0, // Would count from database
      workspacesCount: 0,
      sessionsCount: 0,
      lastLogin: new Date().toISOString(),
    };

    success(res, stats);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/upgrade-plan
 * @desc    Upgrade user plan
 * @access  Private
 */
router.post("/upgrade-plan", authenticate, (req, res, next) => {
  try {
    const { plan } = req.body;

    if (!["pro", "enterprise"].includes(plan)) {
      return error(res, { message: "Invalid plan" }, 400);
    }

    const user = users.get(req.userId);

    if (!user) {
      return error(res, { message: "User not found" }, 404);
    }

    user.plan = plan;

    // Set quotas based on plan
    if (plan === "pro") {
      user.colabQuota = 50; // 50 hours
    } else if (plan === "enterprise") {
      user.colabQuota = 200; // 200 hours
    }

    const { password: _, ...userWithoutPassword } = user;

    success(res, userWithoutPassword, 200, `Upgraded to ${plan} plan`);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.post("/google/callback", validate(schemas.googleAuth), (req, res, next) => {
  try {
    const { code, profile } = req.body;

    // In production, exchange code for tokens with Google
    // For now, create or link user
    let user = null;

    for (const u of users.values()) {
      if (u.googleId === profile.id) {
        user = u;
        break;
      }
    }

    if (!user) {
      // Create new user
      const userId = crypto.randomUUID();
      user = {
        userId,
        email: profile.email,
        googleId: profile.id,
        name: profile.name,
        plan: "free",
        createdAt: new Date().toISOString(),
        colabQuota: 0,
        colabQuotaUsed: 0,
      };
      users.set(userId, user);
    }

    const token = generateToken(user.userId);

    const { password: _, ...userWithoutPassword } = user;

    success(res, {
      user: userWithoutPassword,
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/auth/google/url
 * @desc    Get Google OAuth URL
 * @access  Public
 */
router.get("/google/url", (req, res) => {
  try {
    const clientId = config.services.googleClientId;
    const redirectUri = "http://localhost:3000/auth/google/callback";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent("email profile")}&` +
      `access_type=offline&` +
      `prompt=consent`;

    success(res, { url: authUrl });
  } catch (err) {
    error(res, err);
  }
});

/**
 * @route   POST /api/auth/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post("/newsletter/subscribe", (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, { message: "Email required" }, 400);
    }

    // In production, save to database or send to Mailchimp
    console.log(`[Newsletter] Subscription: ${email}`);

    success(res, null, 200, "Subscribed to newsletter");
  } catch (err) {
    next(err);
  }
});

export default router;
