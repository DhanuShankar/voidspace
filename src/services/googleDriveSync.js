import { google } from "googleapis";
import crypto from "crypto";

/**
 * Google Drive Sync Manager
 * Handles file synchronization with Google Drive
 */
class GoogleDriveSyncManager {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.rootFolderId = null;
  }

  /**
   * Initialize Google Drive client with credentials
   */
  setCredentials(credentials) {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      credentials.redirectUri || "http://localhost:3000/auth/google/callback"
    );

    this.auth.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  /**
   * Initialize root folder for this app
   */
  async initializeRootFolder() {
    if (!this.drive) {
      throw new Error("Google Drive not authenticated");
    }

    const folderName = "VOID Programming Sessions";

    // Search for existing folder
    const res = await this.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    let folderId;

    if (res.data.files.length > 0) {
      folderId = res.data.files[0].id;
    } else {
      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: "id",
      });

      folderId = folder.data.id;

      // Make folder publicly readable (optional)
      await this.drive.permissions.create({
        fileId: folderId,
        resource: {
          role: "reader",
          type: "anyone",
        },
      });
    }

    this.rootFolderId = folderId;
    console.log(`[Drive] Root folder initialized: ${folderId}`);

    return folderId;
  }

  /**
   * Save a coding session to Google Drive
   */
  async saveSession(sessionData) {
    if (!this.drive || !this.rootFolderId) {
      throw new Error("Google Drive not initialized");
    }

    const { name, content, metadata } = sessionData;

    // Create a timestamped folder for this session
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sessionFolderName = `${name}_${timestamp}`;

    const sessionFolder = await this.drive.files.create({
      resource: {
        name: sessionFolderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.rootFolderId],
      },
      fields: "id",
    });

    const sessionFolderId = sessionFolder.data.id;

    // Save main content file
    await this.drive.files.create({
      resource: {
        name: "code.py",
        mimeType: "text/plain",
        parents: [sessionFolderId],
      },
      media: {
        mimeType: "text/plain",
        body: content,
      },
      fields: "id",
    });

    // Save metadata as JSON
    if (metadata) {
      const metadataContent = JSON.stringify(metadata, null, 2);
      await this.drive.files.create({
        resource: {
          name: "metadata.json",
          mimeType: "application/json",
          parents: [sessionFolderId],
        },
        media: {
          mimeType: "application/json",
          body: metadataContent,
        },
        fields: "id",
      });
    }

    console.log(`[Drive] Session saved: ${sessionFolderName}`);

    return {
      sessionId: sessionFolderId,
      folderName: sessionFolderName,
      url: `https://drive.google.com/drive/folders/${sessionFolderId}`,
    };
  }

  /**
   * List all saved sessions
   */
  async listSessions() {
    if (!this.drive || !this.rootFolderId) {
      return { sessions: [] };
    }

    const res = await this.drive.files.list({
      q: `'${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id, name, createdTime, iconLink)",
      orderBy: "createdTime desc",
      pageSize: 50,
    });

    const sessions = res.data.files.map((file) => ({
      id: file.id,
      name: file.name,
      createdTime: file.createdTime,
      url: `https://drive.google.com/drive/folders/${file.id}`,
    }));

    return { sessions };
  }

  /**
   * Download a session
   */
  async downloadSession(sessionId) {
    if (!this.drive) {
      throw new Error("Google Drive not authenticated");
    }

    // Get all files in session folder
    const res = await this.drive.files.list({
      q: `'${sessionId}' in parents`,
      fields: "files(id, name, mimeType)",
      pageSize: 100,
    });

    const files = {};

    for (const file of res.data.files) {
      if (file.mimeType === "text/plain" || file.mimeType === "application/json") {
        const fileRes = await this.drive.files.get({
          fileId: file.id,
          alt: "media",
        });

        files[file.name] = fileRes.data;
      }
    }

    return files;
  }

  /**
   * Delete a session from Drive
   */
  async deleteSession(sessionId) {
    if (!this.drive) {
      throw new Error("Google Drive not authenticated");
    }

    await this.drive.files.delete({
      fileId: sessionId,
    });

    console.log(`[Drive] Session deleted: ${sessionId}`);

    return { success: true };
  }
}

export default new GoogleDriveSyncManager();
