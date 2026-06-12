import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * User database simulation (use real database in production)
 */
const users: Map<string, any> = new Map();
const sessions: Map<string, any> = new Map();

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  googleId?: string;
  subscriptionPlan: 'free' | 'pro' | 'enterprise';
  colabQuotaHours: number;
}

interface Session {
  userId: string;
  token: string;
  expiresAt: number;
  colabSessionId?: string;
}

/**
 * Resolve the JWT secret, with a hard warning in production if not set.
 * In development a random per-process secret is generated so tokens are
 * invalidated on restart — that is intentional and safe.
 */
function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production. ' +
      'Set a strong random value (e.g. `openssl rand -hex 64`) in your .env file.'
    );
  }

  // Development-only ephemeral secret — rotates on every server restart.
  if (!_devSecret) {
    _devSecret = require('crypto').randomBytes(64).toString('hex');
    console.warn(
      '⚠  JWT_SECRET not set — using a per-process ephemeral secret (dev only). ' +
      'All tokens will be invalidated on server restart.'
    );
  }
  return _devSecret;
}
let _devSecret: string | null = null;

/**
 * Generate JWT token
 */
export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
}

/**
 * Create new user
 */
export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; token: string } | null> {
  // Check if user exists
  const existing = Array.from(users.values()).find((u) => u.email === email);
  if (existing) {
    throw new Error('Email already registered');
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
      subscriptionPlan: 'free',
      colabQuotaHours: 10, // Free plan gets 10 hours/month
    };

    users.set(user.id, user);

    const token = generateToken(user.id);

    console.log(`✓ User created: ${email}`);

    return {
      user: {
        ...user,
        passwordHash: undefined, // Don't return password hash
      } as any,
      token,
    };
  } catch (error) {
    console.error('User creation error:', error);
    throw error;
  }
}

/**
 * Authenticate user with email/password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: User; token: string } | null> {
  const user = Array.from(users.values()).find((u) => u.email === email);

  if (!user) {
    throw new Error('User not found');
  }

  try {
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = generateToken(user.id);

    console.log(`✓ User authenticated: ${email}`);

    return {
      user: {
        ...user,
        passwordHash: undefined,
      } as any,
      token,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): User | null {
  const user = users.get(userId);
  if (user) {
    return {
      ...user,
      passwordHash: undefined,
    } as any;
  }
  return null;
}

/**
 * Create or link Google OAuth user
 */
export async function createOrLinkGoogleUser(
  googleId: string,
  email: string,
  name: string
): Promise<{ user: User; token: string }> {
  // Check if user exists with this Google ID
  let user = Array.from(users.values()).find((u) => u.googleId === googleId);

  if (!user) {
    // Check if user exists with this email
    user = Array.from(users.values()).find((u) => u.email === email);

    if (!user) {
      // Create new user
      user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        name,
        passwordHash: '', // No password for OAuth users
        googleId,
        createdAt: new Date().toISOString(),
        subscriptionPlan: 'free',
        colabQuotaHours: 10,
      };

      users.set(user.id, user);
      console.log(`✓ New Google user created: ${email}`);
    } else {
      // Link Google ID to existing user
      user.googleId = googleId;
      users.set(user.id, user);
      console.log(`✓ Google account linked: ${email}`);
    }
  }

  const token = generateToken(user.id);

  return {
    user: {
      ...user,
      passwordHash: undefined,
    } as any,
    token,
  };
}

/**
 * Update user's Colab quota
 */
export function updateColabQuota(userId: string, hoursUsed: number): boolean {
  const user = users.get(userId);

  if (!user) return false;

  user.colabQuotaHours = Math.max(0, user.colabQuotaHours - hoursUsed);
  users.set(userId, user);

  console.log(`✓ Updated Colab quota for ${userId}: ${user.colabQuotaHours}h remaining`);

  return true;
}

/**
 * Upgrade user plan
 */
export function upgradeUserPlan(
  userId: string,
  plan: 'pro' | 'enterprise'
): User | null {
  const user = users.get(userId);

  if (!user) return null;

  user.subscriptionPlan = plan;

  // Update quota based on plan
  if (plan === 'pro') {
    user.colabQuotaHours = 100; // Pro gets 100 hours/month
  } else if (plan === 'enterprise') {
    user.colabQuotaHours = 999999; // Enterprise unlimited
  }

  users.set(userId, user);

  console.log(`✓ User upgraded to plan: ${plan}`);

  return {
    ...user,
    passwordHash: undefined,
  } as any;
}

/**
 * Create session record
 */
export function createSession(userId: string, colabSessionId?: string): Session {
  const token = generateToken(userId);
  const session: Session = {
    userId,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    colabSessionId,
  };

  sessions.set(token, session);

  return session;
}

/**
 * Get user stats
 */
export function getUserStats(userId: string): any {
  const user = users.get(userId);

  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    plan: user.subscriptionPlan,
    colabQuotaHours: user.colabQuotaHours,
    createdAt: user.createdAt,
    joinedDays: Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    ),
  };
}

/**
 * Delete user account
 */
export function deleteUser(userId: string): boolean {
  if (users.has(userId)) {
    users.delete(userId);
    console.log(`✓ User deleted: ${userId}`);
    return true;
  }
  return false;
}

/**
 * List all users (admin only)
 */
export function listUsers(): any[] {
  return Array.from(users.values()).map((u) => ({
    ...u,
    passwordHash: undefined,
  }));
}
