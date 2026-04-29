/**
 * Session Manager - Handles session persistence, auto-save, and versioning
 */
class SessionManager {
  constructor(options = {}) {
    this.storageProvider = options.storageProvider || new GoogleDriveProvider();
    this.autoSaveInterval = options.autoSaveInterval || 30000; // 30 seconds
    this.versionHistoryLimit = options.versionHistoryLimit || 50;
    this.currentSession = null;
    this.versionHistory = [];
    this.autoSaveTimer = null;
    this.changeListeners = [];
  }

  /**
   * Initialize session manager
   */
  async init() {
    try {
      await this.loadSession();
      this.startAutoSave();
    } catch (error) {
      console.error('Failed to initialize session manager:', error);
      // Initialize with empty session if load fails
      this.currentSession = {
        id: this.generateSessionId(),
        timestamp: Date.now(),
        workspaces: {},
        activeWorkspaceId: null,
        version: 1
      };
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Load session from storage
   */
  async loadSession() {
    const sessionData = await this.storageProvider.load('session');
    if (sessionData) {
      this.currentSession = sessionData;
      // Load version history if exists
      const historyData = await this.storageProvider.load('session_history');
      this.versionHistory = historyData || [];
    }
  }

  /**
   * Save session to storage
   */
  async saveSession() {
    if (!this.currentSession) return;

    // Update timestamp
    this.currentSession.timestamp = Date.now();

    // Save current session
    await this.storageProvider.save('session', this.currentSession);

    // Add to version history
    this.addToVersionHistory();

    // Notify listeners
    this.notifyChangeListeners();
  }

  /**
   * Add current state to version history
   */
  addToVersionHistory() {
    const historyEntry = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      session: JSON.parse(JSON.stringify(this.currentSession)) // Deep copy
    };

    this.versionHistory.push(historyEntry);

    // Limit history size
    if (this.versionHistory.length > this.versionHistoryLimit) {
      this.versionHistory.shift();
    }

    // Save history to storage
    this.storageProvider.save('session_history', this.versionHistory);
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.stopAutoSave(); // Clear existing timer
    this.autoSaveTimer = setInterval(() => {
      this.saveSession();
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Register change listener
   */
  onChange(listener) {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify change listeners
   */
  notifyChangeListeners() {
    this.changeListeners.forEach(listener => {
      try {
        listener(this.currentSession);
      } catch (error) {
        console.error('Error in session change listener:', error);
      }
    });
  }

  /**
   * Get current session
   */
  getSession() {
    return JSON.parse(JSON.stringify(this.currentSession)); // Return copy
  }

  /**
   * Update session with partial data
   */
  updateSession(updates) {
    if (!this.currentSession) {
      throw new Error('Session not initialized');
    }
    this.currentSession = {
      ...this.currentSession,
      ...updates,
      version: (this.currentSession.version || 0) + 1
    };
    // Trigger auto-save immediately for important updates
    this.saveSession();
  }

  /**
   * Restore session from version history
   */
  async restoreFromVersion(versionId) {
    const version = this.versionHistory.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    this.currentSession = version.session;
    await this.saveSession();
  }

  /**
   * Get version history
   */
  getVersionHistory() {
    return JSON.parse(JSON.stringify(this.versionHistory));
  }

  /**
   * Clear session and history
   */
  async clear() {
    this.stopAutoSave();
    this.currentSession = null;
    this.versionHistory = [];
    await this.storageProvider.remove('session');
    await this.storageProvider.remove('session_history');
  }
}

/**
 * Google Drive Storage Provider
 * Handles persistence to Google Drive API
 */
class GoogleDriveProvider {
  constructor() {
    // In a real implementation, you would initialize the Google Drive client here
    // This requires OAuth2 authentication and API key setup
    this.initialized = false;
  }

  /**
   * Initialize Google Drive client
   * @returns {Promise<void>}
   */
  async init() {
    // Placeholder for Google Drive initialization
    // In practice, you would use gapi.client.drive or similar
    this.initialized = true;
  }

  /**
   * Save data to Google Drive
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {Promise<void>}
   */
  async save(key, data) {
    if (!this.initialized) {
      await this.init();
    }
    // Placeholder implementation
    // In practice, you would:
    // 1. Check if file exists for this key
    // 2. If exists, update it; else create new file
    // 3. Upload JSON data
    console.log(`Saving ${key} to Google Drive`, data);
    // Simulate async operation
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Load data from Google Drive
   * @param {string} key - Storage key
   * @returns {Promise<any>}
   */
  async load(key) {
    if (!this.initialized) {
      await this.init();
    }
    // Placeholder implementation
    // In practice, you would:
    // 1. Find file by key
    // 2. Download and parse JSON
    console.log(`Loading ${key} from Google Drive`);
    // Simulate async operation
    return new Promise(resolve => {
      setTimeout(() => {
        // Return null to simulate no existing data
        resolve(null);
      }, 100);
    });
  }

  /**
   * Remove data from Google Drive
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    if (!this.initialized) {
      await this.init();
    }
    // Placeholder implementation
    console.log(`Removing ${key} from Google Drive`);
    return new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Fallback Storage Provider (LocalStorage)
 * Used when Google Drive is not available
 */
class LocalStorageProvider {
  /**
   * Save data to localStorage
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   */
  save(key, data) {
    try {
      const serialized = data ? JSON.stringify(data) : null;
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Failed to save to localStorage: ${key}`, error);
    }
  }

  /**
   * Load data from localStorage
   * @param {string} key - Storage key
   * @returns {any}
   */
  load(key) {
    try {
      const serialized = localStorage.getItem(key);
      return serialized ? JSON.parse(serialized) : null;
    } catch (error) {
      console.error(`Failed to load from localStorage: ${key}`, error);
      return null;
    }
  }

  /**
   * Remove data from localStorage
   * @param {string} key - Storage key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove from localStorage: ${key}`, error);
    }
  }
}

// Export for use in other modules
export { SessionManager, GoogleDriveProvider, LocalStorageProvider };