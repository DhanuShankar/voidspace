/**
 * Google OAuth 2.0 Authentication Service
 * VOID Cloud IDE - Secure Authentication Module
 * @version 2.0.0
 * 
 * Features:
 * - OAuth 2.0 Authorization Code Flow
 * - Secure token storage with encryption
 * - Automatic token refresh
 * - Token revocation
 * - User profile management
 * - Offline access support
 * - PKCE support
 */

import { google } from 'googleapis';
import crypto from 'crypto';
import config from '../../config/google.config.js';

// Encryption utility for secure token storage
class TokenEncryption {
  static algorithm = 'aes-256-gcm';
  static keyLength = 32;
  static ivLength = 12;
  static tagLength = 16;
  
  static getEncryptionKey() {
    // In production, this should come from a secure key management system
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
      // Fallback: generate deterministic key from client secret (not recommended for production)
      console.warn('TOKEN_ENCRYPTION_KEY not set, using fallback key');
      return crypto.createHash('sha256').update(config.oauth.clientSecret).digest();
    }
    return Buffer.from(key, 'hex');
  }
  
  static encrypt(text) {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Token encryption failed');
    }
  }
  
  static decrypt(encryptedObj) {
    try {
      const key = this.getEncryptionKey();
      const iv = Buffer.from(encryptedObj.iv, 'hex');
      const tag = Buffer.from(encryptedObj.tag, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Token decryption failed');
    }
  }
}

// Secure Token Storage Manager
class SecureTokenStorage {
  static prefix = 'void_google_';
  
  static createStorageKey(key) {
    return `${this.prefix}${key}`;
  }
  
  static store(key, value) {
    try {
      const storageKey = this.createStorageKey(key);
      
      if (config.oauth.tokenStorage.encryption) {
        const encrypted = TokenEncryption.encrypt(JSON.stringify(value));
        localStorage.setItem(storageKey, JSON.stringify(encrypted));
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to store token for key ${key}:`, error);
      return false;
    }
  }
  
  static retrieve(key) {
    try {
      const storageKey = this.createStorageKey(key);
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) return null;
      
      if (config.oauth.tokenStorage.encryption) {
        const encryptedObj = JSON.parse(stored);
        const decrypted = TokenEncryption.decrypt(encryptedObj);
        return JSON.parse(decrypted);
      }
      
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Failed to retrieve token for key ${key}:`, error);
      return null;
    }
  }
  
  static remove(key) {
    const storageKey = this.createStorageKey(key);
    localStorage.removeItem(storageKey);
    return true;
  }
  
  static clear() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// OAuth 2.0 Client with enhanced security
class OAuth2Client {
  constructor() {
    this.client = new google.auth.OAuth2(
      config.oauth.clientId,
      config.oauth.clientSecret,
      config.oauth.callbackUrl
    );
    
    this.tokenRefreshListeners = [];
    this.tokenExpiryCheckInterval = null;
    this.setupTokenRefreshMonitoring();
  }
  
  /**
   * Generate authorization URL with security parameters
   * @param {Object} options - Additional OAuth options
   * @returns {string} Authorization URL
   */
  generateAuthUrl(options = {}) {
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    // Store PKCE and state in session
    this.storeSessionData('oauth_state', state);\n    this.storeSessionData('code_verifier', codeVerifier);
    
    const authUrl = this.client.generateAuthUrl({
      access_type: config.oauth.accessType,
      scope: config.oauth.scopes,
      prompt: config.oauth.prompt,
      response_type: config.oauth.responseType,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: config.security.pkce.method,
      include_granted_scopes: true,
      ...options,
    });
    
    return authUrl;
  }
  
  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<Object>} Token response
   */
  async getTokenFromCode(code, state) {
    // Verify state for CSRF protection
    if (config.security.stateParameter.enabled) {
      const storedState = this.getSessionData('oauth_state');
      if (!storedState || storedState !== state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }
    }
    
    const codeVerifier = this.getSessionData('code_verifier');
    
    try {
      const { tokens } = await this.client.getToken({
        code,
        code_verifier: codeVerifier,
      });
      
      // Set credentials
      this.client.setCredentials(tokens);
      
      // Store tokens securely
      this.storeTokens(tokens);
      
      // Schedule token refresh if needed
      this.scheduleTokenRefresh(tokens);
      
      return tokens;
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }
  
  /**
   * Set OAuth credentials
   * @param {Object} credentials - OAuth credentials
   */
  setCredentials(credentials) {
    this.client.setCredentials(credentials);
    this.storeTokens(credentials);
    this.scheduleTokenRefresh(credentials);
  }
  
  /**
   * Get current auth client
   * @returns {OAuth2Client} Google OAuth2 client
   */
  getAuthClient() {
    return this.client;
  }
  
  /**
   * Check if token is valid
   * @returns {boolean} Token validity
   */
  async isTokenValid() {
    const credentials = this.client.credentials;
    
    if (!credentials.access_token) {
      return false;
    }
    
    if (!config.tokenManagement.validation.checkExpiry) {
      return true;
    }
    
    const expiryTime = this.getTokenExpiryTime();
    const now = Date.now();
    
    // Check if token is expired or will expire soon
    return expiryTime > now + config.tokenManagement.refresh.refreshThreshold;
  }
  
  /**
   * Refresh access token if expired or expiring soon
   * @returns {Promise<string|null>} New access token or null if failed
   */
  async refreshAccessToken() {
    const credentials = this.client.credentials;
    
    if (!credentials.refresh_token) {
      console.warn('No refresh token available');
      return null;
    }
    
    if (!await this.isTokenRefreshNeeded()) {
      return credentials.access_token;
    }
    
    try {
      const { credentials: newCredentials } = await this.client.refreshAccessToken();
      
      // Update stored tokens
      this.storeTokens(newCredentials);
      this.scheduleTokenRefresh(newCredentials);
      
      // Notify listeners
      this.notifyTokenRefresh(newCredentials);
      
      return newCredentials.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if token refresh is needed
   * @returns {boolean} Whether refresh is needed
   */
  async isTokenRefreshNeeded() {
    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return false;
    
    const now = Date.now();
    const threshold = config.tokenManagement.refresh.refreshThreshold;
    
    return expiryTime - now <= threshold;
  }
  
  /**
   * Get access token (refreshes if needed)
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken() {
    if (await this.isTokenValid()) {
      return this.client.credentials.access_token;
    }
    
    const newToken = await this.refreshAccessToken();
    if (!newToken) {
      throw new Error('Unable to obtain valid access token');
    }
    
    return newToken;
  }
  
  /**
   * Revoke OAuth token
   * @param {string} token - Token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async revokeToken(token) {
    try {
      await this.client.revokeToken(token);
      this.clearTokens();
      return true;
    } catch (error) {
      console.error('Token revocation failed:', error);
      throw error;
    }
  }
  
  /**
   * Revoke all tokens for the user
   * @returns {Promise<boolean>} Success status
   */
  async revokeAllTokens() {
    const credentials = this.client.credentials;
    
    if (credentials.access_token) {
      await this.revokeToken(credentials.access_token);
    }
    
    if (credentials.refresh_token) {
      await this.revokeToken(credentials.refresh_token);
    }
    
    return true;
  }
  
  /**
   * Get user profile from Google
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile() {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.client });
      const { data } = await oauth2.userinfo.get();
      
      const profile = {
        id: data.id,
        email: data.email,
        verifiedEmail: data.verified_email,
        name: data.name,
        givenName: data.given_name,
        familyName: data.family_name,
        picture: data.picture,
        locale: data.locale,
        hd: data.hd,
        retrievedAt: new Date().toISOString(),
      };
      
      // Store profile
      this.storeUserProfile(profile);
      
      return profile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  }
  
  /**
   * Store user profile
   * @param {Object} profile - User profile
   */
  storeUserProfile(profile) {
    SecureTokenStorage.store('user_profile', profile);
  }
  
  /**
   * Get stored user profile
   * @returns {Object|null} User profile or null
   */
  getUserProfileStored() {
    return SecureTokenStorage.retrieve('user_profile');
  }
  
  /**
   * Store tokens securely
   * @param {Object} tokens - OAuth tokens
   */
  storeTokens(tokens) {
    const now = Date.now();
    const expiryTime = tokens.expiry_date || now + (tokens.expires_in * 1000);
    
    SecureTokenStorage.store('access_token', tokens.access_token);
    
    if (tokens.refresh_token) {
      SecureTokenStorage.store('refresh_token', tokens.refresh_token);
    }
    
    SecureTokenStorage.store('expiry_time', expiryTime);
    SecureTokenStorage.store('token_type', tokens.token_type);
    SecureTokenStorage.store('scopes', tokens.scope || config.oauth.scopes);
  }
  
  /**
   * Get token expiry time
   * @returns {number|null} Expiry timestamp or null
   */
  getTokenExpiryTime() {
    return SecureTokenStorage.retrieve('expiry_time');
  }
  
  /**
   * Clear all stored tokens
   */
  clearTokens() {
    SecureTokenStorage.clear();
    this.client.setCredentials({});
    this.cancelTokenRefreshMonitoring();
  }
  
  /**
   * Schedule token refresh
   * @param {Object} tokens - OAuth tokens
   */
  scheduleTokenRefresh(tokens) {
    if (!config.tokenManagement.refresh.enabled) return;
    
    const expiryTime = tokens.expiry_date || Date.now() + (tokens.expires_in * 1000);
    const refreshTime = expiryTime - config.tokenManagement.refresh.refreshThreshold;
    const delay = Math.max(refreshTime - Date.now(), 0);
    
    setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Scheduled token refresh failed:', error);
      }
    }, delay);
  }
  
  /**
   * Setup token expiry monitoring
   */
  setupTokenRefreshMonitoring() {
    if (this.tokenExpiryCheckInterval) return;
    
    this.tokenExpiryCheckInterval = setInterval(async () => {
      if (await this.isTokenRefreshNeeded()) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error('Monitoring token refresh failed:', error);
        }
      }
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Cancel token refresh monitoring
   */
  cancelTokenRefreshMonitoring() {
    if (this.tokenExpiryCheckInterval) {
      clearInterval(this.tokenExpiryCheckInterval);
      this.tokenExpiryCheckInterval = null;
    }
  }
  
  /**
   * Add token refresh listener
   * @param {Function} listener - Callback function
   */
  addTokenRefreshListener(listener) {
    this.tokenRefreshListeners.push(listener);
  }
  
  /**
   * Remove token refresh listener
   * @param {Function} listener - Callback function
   */
  removeTokenRefreshListener(listener) {
    this.tokenRefreshListeners = this.tokenRefreshListeners.filter(l => l !== listener);
  }
  
  /**
   * Notify token refresh listeners
   * @param {Object} newCredentials - New token credentials
   */
  notifyTokenRefresh(newCredentials) {
    this.tokenRefreshListeners.forEach(listener => {
      try {
        listener(newCredentials);
      } catch (error) {
        console.error('Token refresh listener error:', error);
      }
    });
  }
  
  /**
   * Generate OAuth state parameter for CSRF protection
   * @returns {string} State value
   */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Generate PKCE code verifier
   * @returns {string} Code verifier
   */
  generateCodeVerifier() {
    return crypto.randomBytes(48).toString('base64url');
  }
  
  /**
   * Generate PKCE code challenge
   * @param {string} verifier - Code verifier
   * @returns {string} Code challenge
   */
  generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }
  
  /**
   * Store session data
   * @param {string} key - Data key
   * @param {any} value - Data value
   */
  storeSessionData(key, value) {
    sessionStorage.setItem(`void_oauth_${key}`, JSON.stringify(value));
  }
  
  /**
   * Get session data
   * @param {string} key - Data key
   * @returns {any} Data value or null
   */
  getSessionData(key) {
    const value = sessionStorage.getItem(`void_oauth_${key}`);
    return value ? JSON.parse(value) : null;
  }
  
  /**
   * Get all available scopes
   * @returns {string[]} Scope list
   */
  getScopes() {
    return config.oauth.scopes;
  }
  
  /**
   * Check if specific scope is granted
   * @param {string} scope - Scope to check
   * @returns {boolean} Whether scope is granted
   */
  hasScope(scope) {
    const grantedScopes = SecureTokenStorage.retrieve('scopes') || [];
    return grantedScopes.includes(scope);
  }
}

// Singleton instance
const oauth2Client = new OAuth2Client();

// Export utility functions
export const generateAuthUrl = (options = {}) => oauth2Client.generateAuthUrl(options);

export const getTokenFromCode = async (code, state) => {
  return oauth2Client.getTokenFromCode(code, state);
};

export const setCredentials = (credentials) => {
  oauth2Client.setCredentials(credentials);
};

export const getAuthClient = () => {
  return oauth2Client.getAuthClient();
};

export const revokeToken = async (token) => {
  return oauth2Client.revokeToken(token);
};

export const revokeAllTokens = async () => {
  return oauth2Client.revokeAllTokens();
};

export const getAccessTokenFromRefresh = async (refreshToken) => {
  const oldRefresh = oauth2Client.client.credentials.refresh_token;
  oauth2Client.client.setCredentials({ refresh_token: refreshToken });
  
  try {
    const { credentials } = await oauth2Client.client.refreshAccessToken();
    oauth2Client.client.setCredentials({ refresh_token: oldRefresh });
    return credentials.access_token;
  } catch (error) {
    oauth2Client.client.setCredentials({ refresh_token: oldRefresh });
    throw error;
  }
};

export const isTokenValid = async () => {
  return oauth2Client.isTokenValid();
};

export const refreshAccessToken = async () => {
  return oauth2Client.refreshAccessToken();
};

export const getAccessToken = async () => {
  return oauth2Client.getAccessToken();
};

export const getUserProfile = async () => {
  return oauth2Client.getUserProfile();
};

export const getUserProfileStored = () => {
  return oauth2Client.getUserProfileStored();
};

export const storeUserProfile = (profile) => {
  oauth2Client.storeUserProfile(profile);
};

export const clearTokens = () => {
  oauth2Client.clearTokens();
};

export const hasScope = (scope) => {
  return oauth2Client.hasScope(scope);
};

export const getScopes = () => {
  return oauth2Client.getScopes();
};

export const addTokenRefreshListener = (listener) => {
  oauth2Client.addTokenRefreshListener(listener);
};

export const removeTokenRefreshListener = (listener) => {
  oauth2Client.removeTokenRefreshListener(listener);
};

export default oauth2Client;
