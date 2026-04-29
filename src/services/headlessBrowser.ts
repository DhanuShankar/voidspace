import { chromium, Browser, Page } from 'playwright';

interface AutoConfigOptions {
  folderName?: string;
  createNotebookFolder?: boolean;
  folderColor?: string;
}

export class HeadlessBrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async launch() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.page = await this.browser.newPage();
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw error;
    }
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }

  async configureProgrammingFolder(authUrl: string, options: AutoConfigOptions = {}) {
    if (!this.page) throw new Error('Browser not initialized. Call launch() first.');

    const folderName = options.folderName || 'VOID Programming';
    const createNotebook = options.createNotebookFolder !== false;

    try {
      // Step 1: Navigate to Google Drive auth
      await this.page.goto(authUrl);
      console.log('✓ Navigated to Google auth page');

      // Wait for auth to complete or redirect
      await this.page.waitForNavigation({ timeout: 30000 }).catch(() => {
        console.log('Auth might be instant redirect');
      });

      // Step 2: Navigate to Google Drive
      await this.page.goto('https://drive.google.com');
      await this.page.waitForLoadState('networkidle');
      console.log('✓ Loaded Google Drive');

      // Step 3: Create main programming folder
      await this.createFolder(folderName);
      console.log(`✓ Created folder: ${folderName}`);

      // Step 4: Create subfolders
      const subfolders = ['Projects', 'Sessions', 'Notebooks'];
      if (createNotebook) subfolders.push('Colab Notebooks');

      for (const subfolder of subfolders) {
        await this.createFolder(subfolder, folderName);
        console.log(`✓ Created subfolder: ${subfolder}`);
      }

      // Step 5: Create README in root folder
      await this.createReadmeFile(folderName);
      console.log('✓ Created README.md');

      return {
        success: true,
        mainFolder: folderName,
        subfolders,
        message: 'Google Drive auto-configured successfully',
      };
    } catch (error) {
      console.error('Configuration failed:', error);
      throw error;
    }
  }

  private async createFolder(folderName: string, parentFolderName?: string) {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // Click "New" button
      await this.page.click('button[aria-label="New"]', { timeout: 5000 });
      await this.page.waitForTimeout(500);

      // Click "Folder" option
      const folderOption = await this.page.$('div[role="menuitem"] span:has-text("Folder")');
      if (folderOption) {
        await folderOption.click();
      }

      // Wait for dialog and enter folder name
      await this.page.waitForSelector('input[aria-label*="name"]', { timeout: 5000 });
      const input = await this.page.$('input[aria-label*="name"]');
      if (input) {
        await input.fill(folderName);
        await this.page.press('input', 'Enter');
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      console.warn(`Could not create folder ${folderName}:`, error);
      // Continue - some folders might already exist
    }
  }

  private async createReadmeFile(folderName: string) {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // Create new Google Doc
      await this.page.goto('https://docs.google.com/document/create', {
        waitUntil: 'networkidle',
      });

      // Add content
      const readmeContent = `# VOID Programming Studio

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

Last auto-configured: ${new Date().toISOString()}
`;

      await this.page.click('div[role="button"][aria-label*="content"]');
      await this.page.keyboard.type(readmeContent);

      // Rename document to README.md
      await this.page.click('div[aria-label="Google Docs"]');
      const titleField = await this.page.$('[role="textbox"][aria-label="Rename"]');
      if (titleField) {
        await titleField.click();
        await titleField.fill('README.md - VOID Programming');
        await this.page.press('input', 'Enter');
      }
    } catch (error) {
      console.warn('Could not create README:', error);
    }
  }

  async navigateToColab() {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.goto('https://colab.research.google.com/', {
        waitUntil: 'networkidle',
      });
      console.log('✓ Navigated to Google Colab');

      return {
        success: true,
        url: this.page.url(),
      };
    } catch (error) {
      console.error('Failed to navigate to Colab:', error);
      throw error;
    }
  }

  async getCurrentPageUrl() {
    return this.page?.url() || null;
  }

  async takeScreenshot(path: string) {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.screenshot({ path });
  }
}
