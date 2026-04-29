import { drive_v3, google } from 'googleapis';
import { getAuthClient } from './googleAuth';

export interface SessionData {
  sessionId: string;
  timestamp: string;
  files: {
    name: string;
    content: string;
    language: string;
  }[];
  sessionTranscript?: string;
  duration?: number;
  notes?: string;
}

export class GoogleDriveSyncManager {
  private drive: drive_v3.Drive;
  private rootFolderId: string | null = null;

  constructor() {
    const auth = getAuthClient();
    this.drive = google.drive({ version: 'v3', auth });
  }

  async initializeRootFolder(folderName: string = 'VOID Programming') {
    try {
      // Search for existing folder
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1,
      });

      if (response.data.files && response.data.files.length > 0) {
        this.rootFolderId = response.data.files[0].id!;
        console.log(`✓ Found existing folder: ${this.rootFolderId}`);
      } else {
        // Create new folder
        const folderRes = await this.drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });

        this.rootFolderId = folderRes.data.id!;
        console.log(`✓ Created new folder: ${this.rootFolderId}`);

        // Create subfolders
        await this.createSubfolders(this.rootFolderId);
      }

      return this.rootFolderId;
    } catch (error) {
      console.error('Failed to initialize root folder:', error);
      throw error;
    }
  }

  private async createSubfolders(parentId: string) {
    const subfolders = ['Projects', 'Sessions', 'Notebooks', 'Colab Notebooks'];

    for (const folderName of subfolders) {
      try {
        await this.drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          },
          fields: 'id',
        });
        console.log(`✓ Created subfolder: ${folderName}`);
      } catch (error) {
        console.warn(`Could not create subfolder ${folderName}:`, error);
      }
    }
  }

  async saveSession(sessionData: SessionData) {
    if (!this.rootFolderId) {
      throw new Error('Root folder not initialized. Call initializeRootFolder() first.');
    }

    try {
      // Get or create Sessions subfolder
      const sessionsFolderId = await this.getOrCreateSubfolder('Sessions', this.rootFolderId);

      // Create session folder with timestamp
      const sessionFolderName = `Session-${sessionData.sessionId}-${new Date(sessionData.timestamp).toISOString().split('T')[0]}`;
      const sessionFolderId = await this.createDetachedFolder(sessionFolderName, sessionsFolderId);

      // Save each file
      for (const file of sessionData.files) {
        await this.uploadFile(
          `${file.name}.${this.getFileExtension(file.language)}`,
          file.content,
          sessionFolderId,
          `text/${this.getMimeType(file.language)}`
        );
      }

      // Save session metadata
      const metadata = {
        sessionId: sessionData.sessionId,
        timestamp: sessionData.timestamp,
        fileCount: sessionData.files.length,
        duration: sessionData.duration || 0,
        notes: sessionData.notes || '',
        transcriptAvailable: !!sessionData.sessionTranscript,
      };

      await this.uploadFile(
        'session-metadata.json',
        JSON.stringify(metadata, null, 2),
        sessionFolderId,
        'application/json'
      );

      // Save transcript if available
      if (sessionData.sessionTranscript) {
        await this.uploadFile(
          'session-transcript.md',
          sessionData.sessionTranscript,
          sessionFolderId,
          'text/markdown'
        );
      }

      console.log(`✓ Saved session: ${sessionData.sessionId}`);
      return sessionFolderId;
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async saveProjectFile(fileName: string, content: string, language: string = 'plaintext') {
    if (!this.rootFolderId) {
      throw new Error('Root folder not initialized.');
    }

    try {
      const projectsFolderId = await this.getOrCreateSubfolder('Projects', this.rootFolderId);

      const fileExtension = this.getFileExtension(language);
      const mimeType = this.getMimeType(language);

      const fileId = await this.uploadFile(`${fileName}.${fileExtension}`, content, projectsFolderId, mimeType);

      console.log(`✓ Saved project file: ${fileName}`);
      return fileId;
    } catch (error) {
      console.error('Failed to save project file:', error);
      throw error;
    }
  }

  async saveNotebook(notebookName: string, notebookContent: string) {
    if (!this.rootFolderId) {
      throw new Error('Root folder not initialized.');
    }

    try {
      const notebooksFolderId = await this.getOrCreateSubfolder('Notebooks', this.rootFolderId);
      const fileId = await this.uploadFile(
        `${notebookName}.ipynb`,
        notebookContent,
        notebooksFolderId,
        'application/ipynb+zip'
      );

      console.log(`✓ Saved notebook: ${notebookName}`);
      return fileId;
    } catch (error) {
      console.error('Failed to save notebook:', error);
      throw error;
    }
  }

  async listProjectFiles() {
    if (!this.rootFolderId) {
      throw new Error('Root folder not initialized.');
    }

    try {
      const projectsFolderId = await this.getOrCreateSubfolder('Projects', this.rootFolderId);

      const response = await this.drive.files.list({
        q: `'${projectsFolderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, modifiedTime, mimeType)',
        pageSize: 50,
        orderBy: 'modifiedTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Failed to list project files:', error);
      throw error;
    }
  }

  async listSessions() {
    if (!this.rootFolderId) {
      throw new Error('Root folder not initialized.');
    }

    try {
      const sessionsFolderId = await this.getOrCreateSubfolder('Sessions', this.rootFolderId);

      const response = await this.drive.files.list({
        q: `'${sessionsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, modifiedTime)',
        pageSize: 50,
        orderBy: 'modifiedTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Failed to list sessions:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<string> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        let data = '';
        response.data.on('data', (chunk) => {
          data += chunk;
        });
        response.data.on('end', () => resolve(data));
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string) {
    try {
      await this.drive.files.delete({ fileId });
      console.log(`✓ Deleted file: ${fileId}`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  private async uploadFile(fileName: string, content: string, folderId: string, mimeType: string) {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: mimeType,
          parents: [folderId],
        },
        media: {
          mimeType: 'text/plain',
          body: content,
        },
        fields: 'id',
      });

      return response.data.id!;
    } catch (error) {
      console.error(`Failed to upload file ${fileName}:`, error);
      throw error;
    }
  }

  private async getOrCreateSubfolder(folderName: string, parentId: string): Promise<string> {
    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id)',
        pageSize: 1,
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      const createRes = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      });

      return createRes.data.id!;
    } catch (error) {
      console.error(`Failed to get or create subfolder ${folderName}:`, error);
      throw error;
    }
  }

  private async createDetachedFolder(folderName: string, parentId: string): Promise<string> {
    const response = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    return response.data.id!;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      react: 'tsx',
      jsx: 'jsx',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
      plaintext: 'txt',
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  private getMimeType(language: string): string {
    const mimeTypes: Record<string, string> = {
      javascript: 'text/javascript',
      typescript: 'text/typescript',
      python: 'text/x-python',
      react: 'text/typescript',
      jsx: 'text/jsx',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      markdown: 'text/markdown',
      plaintext: 'text/plain',
    };

    return mimeTypes[language.toLowerCase()] || 'text/plain';
  }
}
