import { OAuth2Client } from 'google-auth-library';
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { BrowserAutomationService, OAuthState, AuthFlowResult } from './browserAutomation';

export interface DriveConfig {
  folderName: string;
  createSubfolders: boolean;
  subfolderNames: string[];
  overwriteExisting: boolean;
  createReadme: boolean;
  readmeContent?: string;
}

export interface CredentialStorage {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
  accountEmail?: string;
  created: string;
  lastRefreshed?: string;
}

export interface AutoConfigResult {
  success: boolean;
  folderId?: string;
  folderUrl?: string;
  credentials?: CredentialStorage;
  screenshots?: string[];
  message: string;
  error?: string;
}

export interface AccountConfig {
  id: string;
  email: string;
  nickname?: string;
  profileImage?: string;
  enabled: boolean;
  lastRefreshed?: string;
}

const DEFAULT_DRIVE_CONFIG: DriveConfig = {
  folderName: 'VOID Programming',
  createSubfolders: true,
  subfolderNames: ['Projects', 'Sessions', 'Notebooks', 'Colab Notebooks'],
  overwriteExisting: false,
  createReadme: true,
  readmeContent: `# VOID Programming Studio

## Overview
This folder contains all your programming projects, sessions, and code snippets saved from VOID IDE.

## Folder Structure
- **Projects**: Main programming projects and code files
- **Sessions**: Session recordings and transcripts
- **Notebooks**: Interactive Jupyter notebooks
- **Colab Notebooks**: Google Colab integration notebooks

## Auto-Sync Features
- All code changes are automatically saved
- Sessions are recorded with timestamps
- Notebooks are backed up to Colab

Last auto-configured: ${new Date().toISOString()}`,
};

export class DriveAutoConfigService {
  private browserService: BrowserAutomationService;
  private drive: drive_v3.Drive | null = null;
  private authClient: OAuth2Client | null = null;
  private config: DriveConfig;
  private credentialsDir: string;
  private activeAccountId: string | null = null;
  private accounts: Map<string, AccountConfig> = new Map();

  constructor(
    browserService: BrowserAutomationService,
    config: Partial<DriveConfig> = {},
    credentialsDir?: string
  ) {
    this.browserService = browserService;
    this.config = { ...DEFAULT_DRIVE_CONFIG, ...config };
    this.credentialsDir = credentialsDir || path.join(process.cwd(), 'credentials');
    this.ensureCredentialsDir();
  }

  /**
   * Ensure credentials directory exists
   */
  private ensureCredentialsDir(): void {
    if (!fs.existsSync(this.credentialsDir)) {
      fs.mkdirSync(this.credentialsDir, { recursive: true });
    }
  }

  /**
   * Get credentials file path for an account
   */
  private getCredentialsPath(accountId: string): string {
    return path.join(this.credentialsDir, `${accountId}.json`);
  }

  /**
   * Save credentials to file
   */
  private saveCredentials(accountId: string, credentials: CredentialStorage): void {
    const filepath = this.getCredentialsPath(accountId);
    fs.writeFileSync(filepath, JSON.stringify(credentials, null, 2));
  }

  /**
   * Load credentials from file
   */
  private loadCredentials(accountId: string): CredentialStorage | null {
    const filepath = this.getCredentialsPath(accountId);
    if (!fs.existsSync(filepath)) return null;

    try {
      const data = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(data) as CredentialStorage;
    } catch (error) {
      console.error(`Failed to load credentials for ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Delete credentials file
   */
  private deleteCredentials(accountId: string): boolean {
    const filepath = this.getCredentialsPath(accountId);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  /**
   * List all saved accounts
   */
  listAccounts(): AccountConfig[] {
    const accountFiles = fs.readdirSync(this.credentialsDir).filter(f => f.endsWith('.json'));
    const accounts: AccountConfig[] = [];

    for (const file of accountFiles) {
      const accountId = path.basename(file, '.json');
      const credentials = this.loadCredentials(accountId);
      if (credentials) {
        accounts.push({
          id: accountId,
          email: credentials.accountEmail || accountId,
          enabled: true,
          lastRefreshed: credentials.lastRefreshed,
        });
      }
    }

    return accounts;
  }

  /**
   * Register a new account
   */
  async registerAccount(accountId: string, email: string, options?: Partial<AccountConfig>): Promise<void> {
    this.accounts.set(accountId, {
      id: accountId,
      email,
      nickname: options?.nickname || email.split('@')[0],
      profileImage: options?.profileImage,
      enabled: true,
    });
  }

  /**
   * Switch active account
   */
  setActiveAccount(accountId: string): void {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account not registered: ${accountId}`);
    }
    this.activeAccountId = accountId;
  }

  /**
   * Get active account
   */
  getActiveAccount(): AccountConfig | null {
    if (!this.activeAccountId) return null;
    return this.accounts.get(this.activeAccountId) || null;
  }

  /**
   * Initialize OAuth client with saved credentials
   */
  private initAuthClient(credentials: CredentialStorage): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
      scope: credentials.scope,
      token_type: credentials.tokenType,
      id_token: credentials.idToken,
    });

    this.authClient = auth;
    this.drive = google.drive({ version: 'v3', auth });

    return auth;
  }

  /**
   * Perform non-interactive OAuth flow
   * Uses saved refresh token or triggers interactive auth if needed
   */
  async authenticateNonInteractive(accountId?: string): Promise<AuthFlowResult> {
    const targetAccount = accountId || this.activeAccountId || 'default';

    // Check for existing credentials
    const credentials = this.loadCredentials(targetAccount);
    if (credentials) {
      try {
        this.initAuthClient(credentials);
        this.activeAccountId = targetAccount;

        // Try to refresh if needed
        if (this.authClient && this.authClient.credentials.expiry_date && this.authClient.credentials.expiry_date < Date.now()) {
          if (this.authClient.credentials.refresh_token) {
            try {
              const { credentials: newCreds } = await this.authClient.refreshAccessToken();
              const updated = { ...credentials, ...newCreds, lastRefreshed: new Date().toISOString() };
               this.saveCredentials(targetAccount, updated);
               if (this.browserService.isDebugMode()) {
                 console.log('✓ Token refreshed automatically');
               }
            } catch (refreshError) {
              // Refresh failed, need interactive auth
              console.warn('Token refresh failed, need interactive authentication');
              return { success: false, error: 'refresh_failed' };
            }
          }
        }

        return { success: true, tokens: credentials };
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      }
    }

    // No credentials found, need interactive auth
    return { success: false, error: 'no_credentials' };
  }

  /**
   * Perform interactive OAuth flow using browser automation
   */
  async authenticateInteractive(profileId?: string): Promise<AuthFlowResult> {
    const screenshots: string[] = [];
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      return { success: false, error: 'Missing OAuth credentials' };
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      prompt: 'consent',
    });

    try {
      // Launch browser with profile if specified
      await this.browserService.launch(profileId);
      screenshots.push(...this.browserService.getCapturedScreenshots());

      // Navigate to auth URL
      await this.browserService.navigateWithRetry(authUrl);
      screenshots.push(...this.browserService.getCapturedScreenshots());

      // Wait for redirect to callback URL
      const timeoutMs = 5 * 60 * 1000; // 5 minutes for user interaction
      const startTime = Date.now();

      let tokens: OAuthState | null = null;
      let authError = false;

      // Poll for tokens
      while (Date.now() - startTime < timeoutMs && !tokens && !authError) {
        const currentUrl = this.browserService.getCurrentUrl();

        if (currentUrl && currentUrl.includes(redirectUri.replace('http://localhost', ''))) {
          // Extract tokens from URL
          tokens = this.browserService['extractTokensFromUrl']?.(currentUrl) || null;

          if (tokens) {
            break;
          }
        }

        // Check for errors
        if (currentUrl && currentUrl.includes('error')) {
          authError = true;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Capture final state
      if (this.browserService.isDebugMode()) {
        screenshots.push(await this.browserService.captureDebugScreenshot('auth-complete'));
      }

      if (authError) {
        return { success: false, error: 'Authorization rejected', screenshots };
      }

      if (!tokens) {
        return { success: false, error: 'Authentication timeout', screenshots };
      }

      // Exchange code for tokens if needed
      if (tokens && !tokens.accessToken) {
        try {
          const { tokens: finalTokens } = await auth.getToken(tokens as any);
          tokens = { ...tokens, ...finalTokens };
        } catch (error) {
          return { success: false, error: 'Token exchange failed', screenshots };
        }
      }

      // Get user info
      let accountEmail = '';
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth });
        const userInfo = await oauth2.userinfo.get();
        accountEmail = userInfo.data.email || '';
      } catch (error) {
        console.warn('Could not fetch user info');
      }

      // Store credentials
      const accountId = accountEmail.replace(/[^a-zA-Z0-9]/g, '_') || 'default';
      const credentialStorage: CredentialStorage = {
        accessToken: tokens.accessToken!,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        idToken: tokens.idToken,
        accountEmail,
        created: new Date().toISOString(),
        lastRefreshed: new Date().toISOString(),
      };

      this.saveCredentials(accountId, credentialStorage);
      await this.registerAccount(accountId, accountEmail);
      this.activeAccountId = accountId;
      this.initAuthClient(credentialStorage);

      return {
        success: true,
        tokens: credentialStorage,
        screenshots,
        message: `Successfully authenticated as ${accountEmail}`,
      };
    } finally {
      if (this.browserService.isConnected()) {
        await this.browserService.close();
      }
    }
  }

  /**
   * Initialize Drive with auto-configuration
   */
  async autoConfigure(accountId?: string, debugMode?: boolean): Promise<AutoConfigResult> {
    const screenshots: string[] = [];

    try {
      // Step 1: Authenticate
      const authResult = await this.authenticateNonInteractive(accountId);

      if (!authResult.success) {
        // Try interactive auth
        const interactiveResult = await this.authenticateInteractive();
        if (!interactiveResult.success) {
          return {
            success: false,
            error: interactiveResult.error || 'Authentication failed',
            screenshots: interactiveResult.screenshots,
            message: 'Failed to authenticate with Google Drive',
          };
        }
        screenshots.push(...(interactiveResult.screenshots || []));
      }

      // Step 2: Ensure Drive client is initialized
      if (!this.drive || !this.authClient) {
        const activeAccount = this.getActiveAccount();
        if (!activeAccount) {
          return { success: false, error: 'No active account', message: 'No account configured' };
        }
        const credentials = this.loadCredentials(activeAccount.id);
        if (!credentials) {
          return { success: false, error: 'Credentials not found', message: 'Credentials not found' };
        }
        this.initAuthClient(credentials);
      }

      // Step 3: Create folder structure
      const folderResult = await this.createDriveStructure();

      // Step 4: Save final credentials if debug mode
      if (debugMode && this.activeAccountId) {
        const creds = this.loadCredentials(this.activeAccountId);
        if (creds) {
          this.saveCredentials(this.activeAccountId, creds);
        }
      }

      return {
        success: true,
        folderId: folderResult.folderId,
        folderUrl: folderResult.folderUrl,
        credentials: this.loadCredentials(this.activeAccountId || 'default'),
        screenshots,
        message: `Google Drive configured successfully: ${this.config.folderName}`,
      };
    } catch (error: any) {
      console.error('Auto-configuration failed:', error);
      return {
        success: false,
        error: error.message,
        screenshots,
        message: `Failed to configure Google Drive: ${error.message}`,
      };
    }
  }

  /**
   * Create Drive folder structure
   */
  private async createDriveStructure(): Promise<{ folderId: string; folderUrl: string }> {
    if (!this.drive) {
      throw new Error('Drive client not initialized');
    }

    const folderName = this.config.folderName;

    // Search for existing folder
    const response = await this.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, webViewLink)',
      pageSize: 1,
    });

    let folderId: string;

    if (response.data.files && response.data.files.length > 0) {
      folderId = response.data.files[0].id!;
      if (this.browserService.isDebugMode()) {
        console.log(`✓ Found existing folder: ${folderId}`);
      }
    } else {
      // Create new folder
      const folderRes = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
      });

      folderId = folderRes.data.id!;
      if (this.browserService.isDebugMode()) {
        console.log(`✓ Created new folder: ${folderId}`);
      }
    }

    // Create subfolders if enabled
    if (this.config.createSubfolders) {
      await this.createSubfolders(folderId);
    }

    // Create README if enabled
    if (this.config.createReadme) {
      await this.createReadmeFile(folderId);
    }

    // Get folder URL
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    return { folderId, folderUrl };
  }

  /**
   * Create subfolders
   */
  private async createSubfolders(parentId: string): Promise<void> {
    for (const folderName of this.config.subfolderNames) {
      try {
        // Check if exists
        const existing = await this.drive!.files.list({
          q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          spaces: 'drive',
          fields: 'files(id)',
          pageSize: 1,
        });

        if (existing.data.files && existing.data.files.length > 0) {
          if (this.browserService.isDebugMode()) {
            console.log(`- Subfolder exists: ${folderName}`);
          }
          continue;
        }

        await this.drive!.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          },
          fields: 'id',
        });

        if (this.browserService.isDebugMode()) {
          console.log(`✓ Created subfolder: ${folderName}`);
        }
      } catch (error) {
        console.warn(`Could not create subfolder ${folderName}:`, error);
      }
    }
  }

  /**
   * Create README file in root folder
   */
  private async createReadmeFile(folderId: string): Promise<void> {
    try {
      const readmeContent = this.config.readmeContent || `# ${this.config.folderName}

Auto-configured by VOID Programming Studio.
`;

      // Create a Google Doc for README
      await this.drive!.files.create({
        requestBody: {
          name: 'README.md - VOID Programming',
          mimeType: 'application/vnd.google-apps.document',
          parents: [folderId],
        },
        fields: 'id',
      });

      if (this.browserService.isDebugMode()) {
        console.log('✓ Created README.md');
      }
    } catch (error) {
      console.warn('Could not create README:', error);
    }
  }

  /**
   * Automatically refresh token if close to expiry
   */
  async ensureValidToken(accountId?: string): Promise<boolean> {
    const targetAccount = accountId || this.activeAccountId;
    if (!targetAccount) return false;

    const credentials = this.loadCredentials(targetAccount);
    if (!credentials || !credentials.refreshToken) {
      return false;
    }

    const isExpiring = credentials.expiryDate && credentials.expiryDate < Date.now() + 5 * 60 * 1000; // within 5 min

    if (isExpiring) {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: credentials.refreshToken });
        const { credentials: newCreds } = await auth.refreshAccessToken();

        const updated = { ...credentials, ...newCreds, lastRefreshed: new Date().toISOString() };
        this.saveCredentials(targetAccount, updated);
        this.initAuthClient(updated);

        if (this.browserService.isDebugMode()) {
          console.log('✓ Token refreshed proactively');
        }
        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Revoke token for an account
   */
  async revokeAccount(accountId: string): Promise<boolean> {
    const credentials = this.loadCredentials(accountId);
    if (!credentials || !credentials.accessToken) return false;

    try {
      const auth = new google.auth.OAuth2();
      await auth.revokeToken(credentials.accessToken);
      this.deleteCredentials(accountId);
      this.accounts.delete(accountId);
      return true;
    } catch (error) {
      console.error('Failed to revoke token:', error);
      return false;
    }
  }

  /**
   * Remove an account
   */
  removeAccount(accountId: string): boolean {
    this.accounts.delete(accountId);
    if (this.activeAccountId === accountId) {
      this.activeAccountId = null;
    }
    return this.deleteCredentials(accountId);
  }

  /**
   * Clear all accounts and credentials
   */
  clearAllAccounts(): void {
    this.accounts.clear();
    this.activeAccountId = null;

    const files = fs.readdirSync(this.credentialsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(this.credentialsDir, file));
    }
  }

  /**
   * Get Drive instance for direct operations
   */
  getDriveClient(): drive_v3.Drive | null {
    return this.drive;
  }

  /**
   * Get auth client for direct operations
   */
  getAuthClient(): OAuth2Client | null {
    return this.authClient;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DriveConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DriveConfig {
    return { ...this.config };
  }
}

// Factory function to create service with environment-based config
export const createDriveAutoConfig = (browserService?: BrowserAutomationService): DriveAutoConfigService => {
  const isDebug = process.env.DEBUG_DRIVE === 'true' || process.env.NODE_ENV === 'development';
  const config: Partial<DriveConfig> = {
    folderName: process.env.DRIVE_FOLDER_NAME || 'VOID Programming',
    createSubfolders: process.env.DRIVE_CREATE_SUBFOLDERS !== 'false',
    createReadme: process.env.DRIVE_CREATE_README !== 'false',
  };

  return new DriveAutoConfigService(
    browserService || new BrowserAutomationService({ headless: true, debugLogs: isDebug, debugScreenshots: isDebug }),
    config
  );
};
