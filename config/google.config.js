/**
 * Google OAuth 2.0 & Drive API Configuration
 * VOID Cloud IDE - Google Integration
 * @version 1.0.0
 */

const googleConfig = {
  // OAuth 2.0 Configuration
  oauth: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    
    // OAuth Scopes - comprehensive Drive and user access
    scopes: [
      'https://www.googleapis.com/auth/drive',                    // Full Drive access
      'https://www.googleapis.com/auth/drive.file',              // Per-file access
      'https://www.googleapis.com/auth/drive.readonly',          // Read-only access
      'https://www.googleapis.com/auth/drive.metadata',          // Metadata access
      'https://www.googleapis.com/auth/drive.metadata.readonly', // Read-only metadata
      'https://www.googleapis.com/auth/drive.appdata',           // App data folder
      'https://www.googleapis.com/auth/userinfo.email',         // User email
      'https://www.googleapis.com/auth/userinfo.profile',       // User profile
    ],
    
    // OAuth Parameters
    accessType: 'offline',  // Request refresh token for offline access
    prompt: 'consent',      // Always show consent screen to ensure refresh token
    responseType: 'code',   // Authorization code flow
    
    // Token Configuration
    tokenStorage: {
      type: 'secure',       // secure | session | local
      encryption: true,     // Enable encryption for stored tokens
      keyRotation: true,    // Enable automatic key rotation
    },
  },
  
  // Drive API Configuration
  drive: {
    version: 'v3',
    
    // Root folder configuration
    rootFolder: {
      name: 'VOID Programming',
      description: 'VOID Cloud IDE workspace root directory',
    },
    
    // Default subfolders for workspace organization
    workspaceFolders: [
      { name: 'Projects', description: 'User project files' },
      { name: 'Sessions', description: 'Saved coding sessions' },
      { name: 'Notebooks', description: 'Jupyter notebooks' },
      { name: 'Colab Notebooks', description: 'Google Colab notebooks' },
      { name: 'Snippets', description: 'Code snippets collection' },
      { name: 'Backups', description: 'Automated backups' },
      { name: 'Shared', description: 'Shared workspace files' },
    ],
    
    // File upload configuration
    upload: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      chunkSize: 5 * 1024 * 1024,    // 5MB chunks for resumable upload
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
    },
    
    // List operations configuration
    list: {
      pageSize: 100,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, owners, permissions, quotaBytesUsed)',
    },
    
    // Batch operations
    batch: {
      maxBatchSize: 100,
      rateLimit: 10, // requests per second
    },
    
    // Cache configuration
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxSize: 1000, // Maximum cached items
    },
  },
  
  // Token Management Configuration
  tokenManagement: {
    // Automatic token refresh settings
    refresh: {
      enabled: true,
      // Refresh when token expires in less than 5 minutes
      refreshThreshold: 5 * 60 * 1000, // 5 minutes in milliseconds
      // Maximum retry attempts for refresh
      maxRetries: 3,
      // Delay between retry attempts
      retryDelay: 2000, // 2 seconds
    },
    
    // Token validation
    validation: {
      checkExpiry: true,
      checkScope: true,
      checkAudience: true,
    },
    
    // Token storage keys
    storageKeys: {
      accessToken: 'void_google_access_token',
      refreshToken: 'void_google_refresh_token',
      expiryTime: 'void_google_token_expiry',
      tokenType: 'void_google_token_type',
      scopes: 'void_google_token_scopes',
    },
  },
  
  // User Profile Configuration
  userProfile: {
    // Fields to store from Google profile
    fields: [
      'id',
      'email',
      'verifiedEmail',
      'name',
      'givenName',
      'familyName',
      'picture',
      'locale',
      'hd', // hosted domain
    ],
    
    // Storage settings
    storage: {
      type: 'database', // database | cache | both
      cacheTtl: 3600, // 1 hour
      syncInterval: 60 * 60 * 1000, // Sync every hour
    },
  },
  
  // Permission Management
  permissions: {
    defaultRoles: ['reader', 'writer', 'owner', 'commenter'],
    
    // Default permission settings for new files
    defaults: {
      role: 'writer',
      type: 'user',
      allowFileDiscovery: true,
    },
    
    // Domain-wide delegation settings
    domainWideDelegation: {
      enabled: false,
      adminEmail: null,
    },
  },
  
  // Quota Monitoring Configuration
  quota: {
    enabled: true,
    // Check quota every hour
    checkInterval: 60 * 60 * 1000,
    // Warn when usage exceeds 80%
    warningThreshold: 0.8,
    // Critical when usage exceeds 95%
    criticalThreshold: 0.95,
    
    // Email notifications for quota alerts
    notifications: {
      enabled: true,
      email: process.env.QUOTA_ALERT_EMAIL,
      onWarning: true,
      onCritical: true,
    },
  },
  
  // Security Configuration
  security: {
    // CSRF protection
    csrfProtection: {
      enabled: true,
      tokenLength: 32,
    },
    
    // State parameter for OAuth flow
    stateParameter: {
      enabled: true,
      expiry: 10 * 60 * 1000, // 10 minutes
    },
    
    // PKCE (Proof Key for Code Exchange)
    pkce: {
      enabled: true,
      method: 'S256',
    },
    
    // Token encryption
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
    },
    
    // Session management
    session: {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      slidingExpiration: true,
      maxLifetime: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  
  // Error Handling
  errorHandling: {
    // Known Google API error codes
    knownErrors: {
      '401': 'UNAUTHENTICATED',
      '403': 'INSUFFICIENT_PERMISSIONS',
      '404': 'FILE_NOT_FOUND',
      '409': 'FILE_ALREADY_EXISTS',
      '429': 'RATE_LIMIT_EXCEEDED',
      '500': 'INTERNAL_SERVER_ERROR',
      '503': 'SERVICE_UNAVAILABLE',
    },
    
    // Retry configuration for transient errors
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 30000,
    },
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    includeTokens: false,
    includePersonalData: false,
    
    // Events to log
    events: {
      authentication: true,
      tokenRefresh: true,
      apiCalls: true,
      errors: true,
      quota: true,
    },
  },
  
  // Environment-specific overrides
  environments: {
    development: {
      oauth: {
        callbackUrl: 'http://localhost:3000/api/auth/google/callback',
      },
      logging: {
        level: 'debug',
      },
    },
    production: {
      oauth: {
        prompt: 'select_account consent',
      },
      logging: {
        level: 'warn',
      },
    },
  },
};

// Validate required configuration
const validateConfig = () => {
  const errors = [];
  
  if (!googleConfig.oauth.clientId) {
    errors.push('GOOGLE_CLIENT_ID is required');
  }
  
  if (!googleConfig.oauth.clientSecret) {
    errors.push('GOOGLE_CLIENT_SECRET is required');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Get environment-specific configuration
const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const baseConfig = { ...googleConfig };
  
  if (googleConfig.environments[env]) {
    return {
      ...baseConfig,
      ...googleConfig.environments[env],
      oauth: {
        ...baseConfig.oauth,
        ...googleConfig.environments[env].oauth,
      },
      logging: {
        ...baseConfig.logging,
        ...googleConfig.environments[env].logging,
      },
    };
  }
  
  return baseConfig;
};

// Initialize configuration
const initConfig = () => {
  try {
    validateConfig();
    return getEnvironmentConfig();
  } catch (error) {
    console.error('Failed to initialize Google configuration:', error);
    throw error;
  }
};

const config = initConfig();

export default config;

// Named exports for specific configurations
export const oauthConfig = config.oauth;
export const driveConfig = config.drive;
export const tokenConfig = config.tokenManagement;
export const userProfileConfig = config.userProfile;
export const permissionsConfig = config.permissions;
export const quotaConfig = config.quota;
export const securityConfig = config.security;
export const errorConfig = config.errorHandling;

// Type definitions (for TypeScript)
export type { default as Config } from './types/google-config.types';
