import { chromium, Browser, BrowserContext, Page, BrowserContextOptions } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export interface BrowserProfile {
  id: string;
  name: string;
  userDataDir: string;
  isDefault?: boolean;
}

export interface BrowserConfig {
  headless: boolean;
  userDataDir?: string;
  debugScreenshots: boolean;
  debugLogs: boolean;
  screenshotDir: string;
  defaultViewport?: { width: number; height: number };
  args?: string[];
}

export interface OAuthState {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export interface AuthFlowResult {
  success: boolean;
  tokens?: OAuthState;
  error?: string;
  screenshots?: string[]; // paths to captured screenshots
  message?: string;
}

const DEFAULT_CONFIG: BrowserConfig = {
  headless: true,
  debugScreenshots: false,
  debugLogs: false,
  screenshotDir: './screenshots',
  defaultViewport: { width: 1280, height: 720 },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

export class BrowserAutomationService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private currentProfile: BrowserProfile | null = null;
  private profiles: Map<string, BrowserProfile> = new Map();
  private screenshots: string[] = [];

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure screenshot directory exists
    if (this.config.debugScreenshots) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  /**
   * Initialize browser with optional profile
   */
  async launch(profileId?: string): Promise<void> {
    try {
      const contextOptions: BrowserContextOptions = {
        viewport: this.config.defaultViewport,
      };

      // Configure user data directory for profile persistence
      if (profileId) {
        const profile = this.getProfile(profileId);
        const userDataDir = profile.userDataDir;
        contextOptions.userDataDir = userDataDir;
        this.currentProfile = profile;

        if (this.config.debugLogs) {
          console.log(`Using browser profile: ${profile.name} (${profile.id})`);
        }
      } else if (this.config.userDataDir) {
        contextOptions.userDataDir = this.config.userDataDir;
      }

      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: this.config.args,
      });

      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();

      // Setup event listeners for debugging
      if (this.config.debugLogs) {
        this.setupDebugLogging();
      }

      // Monitor network for OAuth tokens
      this.setupTokenMonitoring();

      if (this.config.debugLogs) {
        console.log('✓ Browser launched successfully');
      }
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Setup debug logging and screenshot capture
   */
  private setupDebugLogging(): void {
    if (!this.page) return;

    this.page.on('console', (msg) => {
      console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
    });

    this.page.on('pageerror', (err) => {
      console.error('[Browser] Page error:', err);
      this.captureDebugScreenshot('pageerror');
    });

    this.page.on('requestfailed', (request) => {
      console.error('[Browser] Request failed:', request.url(), request.failure()?.errorText);
    });
  }

  /**
   * Monitor network responses for OAuth tokens
   */
  private setupTokenMonitoring(): void {
    if (!this.page) return;

    this.page.on('response', async (response) => {
      const url = response.url();
      const request = response.request();

      // Monitor redirects to OAuth callback URLs
      if (url.includes('callback') || url.includes('oauth')) {
        if (this.config.debugLogs) {
          console.log('[OAuth] Callback URL detected:', url);
        }

        // Try to extract token from URL
        const tokens = this.extractTokensFromUrl(url);
        if (tokens && Object.keys(tokens).length > 0) {
          if (this.config.debugLogs) {
            console.log('[OAuth] Tokens extracted from URL');
          }
        }
      }

      // Monitor XHR/fetch responses for token endpoints
      if (request.method() === 'POST' && url.includes('token')) {
        try {
          const text = await response.text();
          if (this.config.debugLogs) {
            console.log('[OAuth] Token response received');
          }
          // Store for later extraction
          this.lastTokenResponse = text;
        } catch (err) {
          // Ignore parse errors
        }
      }
    });
  }

  private lastTokenResponse: string | null = null;

  /**
   * Extract OAuth tokens from a callback URL
   */
  private extractTokensFromUrl(url: string): OAuthState | null {
    try {
      const urlObj = new URL(url);
      const params = Object.fromEntries(urlObj.searchParams.entries());

      if (params.access_token || params.code) {
        return {
          accessToken: params.access_token || undefined,
          refreshToken: params.refresh_token || undefined,
          expiryDate: params.expires_in ? Date.now() + parseInt(params.expires_in) * 1000 : undefined,
          scope: params.scope,
          tokenType: params.token_type,
          idToken: params.id_token || undefined,
        };
      }
    } catch (err) {
      // Invalid URL
    }
    return null;
  }

  /**
   * Navigate to page with timeout and retry
   */
  async navigateWithRetry(url: string, maxRetries: number = 3, timeout: number = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.config.debugLogs) {
          console.log(`Navigating to ${url} (attempt ${attempt}/${maxRetries})`);
        }

        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        // Capture screenshot on navigation if debug mode
        if (this.config.debugScreenshots) {
          await this.captureDebugScreenshot(`nav-${attempt}`);
        }

        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        if (this.config.debugLogs) {
          console.warn(`Navigation attempt ${attempt} failed, retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Wait for navigation with optional timeout handling
   */
  async waitForNavigation(timeout: number = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.waitForNavigation({ timeout });
    } catch (err) {
      if (this.config.debugLogs) {
        console.log('Navigation timeout or no navigation occurred');
      }
    }
  }

  /**
   * Capture screenshot for debugging
   */
  async captureDebugScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);

    await this.page.screenshot({ path: filepath, fullPage: true });
    this.screenshots.push(filepath);

    if (this.config.debugLogs) {
      console.log(`[Debug] Screenshot saved: ${filepath}`);
    }

    return filepath;
  }

  /**
   * Get all captured screenshots for current session
   */
  getCapturedScreenshots(): string[] {
    return [...this.screenshots];
  }

  /**
   * Clear captured screenshots
   */
  clearScreenshots(): void {
    this.screenshots = [];
  }

  /**
   * Inject JavaScript into the page
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.evaluate(fn);
  }

  /**
   * Get cookies for current domain
   */
  async getCookies(): Promise<any[]> {
    if (!this.context) throw new Error('Browser context not initialized');
    return this.context.cookies();
  }

  /**
   * Set cookies
   */
  async setCookies(cookies: any[]): Promise<void> {
    if (!this.context) throw new Error('Browser context not initialized');
    await this.context.addCookies(cookies);
  }

  /**
   * Get localStorage data
   */
  async getLocalStorage(): Promise<Record<string, string>> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });
  }

  /**
   * Wait for selector with timeout
   */
  async waitForSelector(selector: string, timeout: number = 5000): Promise<any> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Click element with optional fallback
   */
  async click(selector: string, timeout: number = 5000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.click(selector, { timeout });
    } catch (error) {
      if (this.config.debugLogs) {
        console.warn(`Could not click ${selector}, trying alternative...`);
      }
      // Try alternative approach: evaluate click
      await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
      }, selector);
    }
  }

  /**
   * Fill input field
   */
  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.fill(selector, value);
  }

  /**
   * Press key
   */
  async press(key: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.keyboard.press(key);
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * Check if browser is still connected
   */
  isConnected(): boolean {
    return this.browser !== null && !this.browser.isClosed();
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();

      this.page = null;
      this.context = null;
      this.browser = null;
      this.currentProfile = null;

      if (this.config.debugLogs) {
        console.log('✓ Browser closed');
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Create a new browser profile
   */
  createProfile(id: string, name: string, baseDir: string = './browser-profiles'): BrowserProfile {
    const userDataDir = path.join(baseDir, id);

    const profile: BrowserProfile = {
      id,
      name,
      userDataDir,
      isDefault: false,
    };

    this.profiles.set(id, profile);

    // Ensure directory exists
    fs.mkdirSync(userDataDir, { recursive: true });

    if (this.config.debugLogs) {
      console.log(`Created profile: ${name} (${id})`);
    }

    return profile;
  }

  /**
   * Get profile by ID
   */
  getProfile(id: string): BrowserProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }
    return profile;
  }

  /**
   * List all profiles
   */
  listProfiles(): BrowserProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string): boolean {
    const profile = this.profiles.get(id);
    if (profile) {
      // Optionally delete the directory
      if (fs.existsSync(profile.userDataDir)) {
        fs.rmSync(profile.userDataDir, { recursive: true, force: true });
      }
      this.profiles.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Set default profile
   */
  setDefaultProfile(id: string): void {
    for (const profile of this.profiles.values()) {
      profile.isDefault = profile.id === id;
    }
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): BrowserProfile | null {
    return this.currentProfile;
  }

  /**
   * Update config at runtime
   */
  updateConfig(newConfig: Partial<BrowserConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate screenshot dir if needed
    if (this.config.debugScreenshots) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  /**
   * Get current config
   */
  getConfig(): BrowserConfig {
    return { ...this.config };
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.config.debugScreenshots || this.config.debugLogs;
  }

  /**
   * Take a manual screenshot
   */
  async takeScreenshot(filepath?: string): Promise<string> {
    const name = filepath || `manual-${Date.now()}`;
    return this.captureDebugScreenshot(name);
  }
}

// Default instance with environment-based config
export const createBrowserAutomation = (): BrowserAutomationService => {
  const isDebug = process.env.DEBUG_BROWSER === 'true' || process.env.NODE_ENV === 'development';
  const headless = process.env.BROWSER_HEADLESS !== 'false';

  return new BrowserAutomationService({
    headless,
    debugScreenshots: isDebug,
    debugLogs: isDebug,
    screenshotDir: process.env.SCREENSHOT_DIR || './screenshots',
  });
};
