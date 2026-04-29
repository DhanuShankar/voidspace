import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import config from "../config/index.js";

/**
 * Authentication Service
 * Handles user authentication, token generation, verification
 */

const USERS = new Map(); // In-memory user store

export const createUser = async (email, password, name) => {
  // Check if user exists
  for (const user of USERS.values()) {
    if (user.email === email) {
      return null;
    }
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(password, 10);

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

  USERS.set(userId, user);

  const token = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};

export const authenticateUser = async (email, password) => {
  let foundUser = null;

  for (const user of USERS.values()) {
    if (user.email === email) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) return null;

  const isMatch = await bcrypt.compare(password, foundUser.password);

  if (!isMatch) return null;

  const token = jwt.sign({ userId: foundUser.userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const { password: _, ...userWithoutPassword } = foundUser;

  return { user: userWithoutPassword, token };
};

export const getUserById = (userId) => {
  const user = USERS.get(userId);
  if (!user) return null;
  const { password: _, ...rest } = user;
  return rest;
};

export const createOrLinkGoogleUser = async (googleId, email, name) => {
  let user = null;

  // Find by googleId
  for (const u of USERS.values()) {
    if (u.googleId === googleId) {
      user = u;
      break;
    }
  }

  if (!user) {
    // Find by email
    for (const u of USERS.values()) {
      if (u.email === email) {
        user = u;
        user.googleId = googleId;
        break;
      }
    }
  }

  if (!user) {
    const userId = crypto.randomUUID();
    user = {
      userId,
      email,
      googleId,
      name,
      plan: "free",
      createdAt: new Date().toISOString(),
      colabQuota: 0,
      colabQuotaUsed: 0,
    };
    USERS.set(userId, user);
  }

  const token = jwt.sign({ userId: user.userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};

export const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
};

export const getUserStats = (userId) => {
  const user = USERS.get(userId);
  if (!user) return null;

  return {
    userId: user.userId,
    plan: user.plan,
    colabQuotaUsed: user.colabQuotaUsed,
    colabQuota: user.colabQuota,
  };
};

export const upgradeUserPlan = (userId, plan) => {
  const user = USERS.get(userId);
  if (!user) return null;

  user.plan = plan;

  if (plan === "pro") {
    user.colabQuota = 50;
  } else if (plan === "enterprise") {
    user.colabQuota = 200;
  }

  const { password: _, ...rest } = user;
  return rest;
};

export const updateColabQuota = (userId, hoursUsed) => {
  const user = USERS.get(userId);
  if (user) {
    user.colabQuotaUsed += hoursUsed;
  }
};
