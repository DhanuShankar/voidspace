import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { authenticate } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { success, error, badRequest, notFound, forbidden } from "../utils/response.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".txt", ".js", ".ts", ".py", ".json", ".md", ".html", ".css", ".yml", ".yaml", ".sh", ".sql", ".java", ".c", ".cpp", ".go", ".rs"];

    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

/**
 * In-memory file storage structure
 * Map of workspaceId -> Map of fileId -> fileData
 */
const fileStorage = new Map();

/**
 * @route   POST /api/files/upload
 * @desc    Upload file to workspace
 * @access  Private
 */
router.post("/upload", authenticate, upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) {
      return badRequest(res, "No file provided");
    }

    const { workspaceId, folderId } = req.body;
    const fileId = crypto.randomUUID();
    const workspace = fileStorage.get(workspaceId) || new Map();

    const fileData = {
      fileId,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      content: req.file.buffer.toString("utf-8"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.userId,
      workspaceId,
      folderId: folderId || null,
      version: 1,
    };

    workspace.set(fileId, fileData);
    fileStorage.set(workspaceId, workspace);

    success(res, {
      fileId,
      name: fileData.name,
      size: fileData.size,
      mimeType: fileData.mimeType,
    }, 201, "File uploaded successfully");
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return error(res, { message: "File too large. Maximum size is 50MB" }, 413);
    }
    next(err);
  }
});

/**
 * @route   GET /api/files/:fileId
 * @desc    Get file by ID
 * @access  Private
 */
router.get("/:fileId", authenticate, (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return badRequest(res, "Workspace ID required");
    }

    const workspace = fileStorage.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    const file = workspace.get(fileId);

    if (!file) {
      return notFound(res, "File not found");
    }

    // Check permissions
    if (file.createdBy !== req.userId) {
      return forbidden(res, "You don't have access to this file");
    }

    success(res, file);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/files/:fileId
 * @desc    Update file content
 * @access  Private
 */
router.put("/:fileId", authenticate, (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { workspaceId, content, name } = req.body;

    if (!workspaceId) {
      return badRequest(res, "Workspace ID required");
    }

    const workspace = fileStorage.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    const file = workspace.get(fileId);

    if (!file) {
      return notFound(res, "File not found");
    }

    // Check permissions
    if (file.createdBy !== req.userId) {
      return forbidden(res, "You don't have access to this file");
    }

    // Update file
    if (content !== undefined) {
      file.content = content;
      file.version += 1;
    }

    if (name !== undefined) {
      file.name = name;
    }

    file.updatedAt = new Date().toISOString();
    workspace.set(fileId, file);

    success(res, file, 200, "File updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete file
 * @access  Private
 */
router.delete("/:fileId", authenticate, (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return badRequest(res, "Workspace ID required");
    }

    const workspace = fileStorage.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    const file = workspace.get(fileId);

    if (!file) {
      return notFound(res, "File not found");
    }

    // Check permissions
    if (file.createdBy !== req.userId) {
      return forbidden(res, "You don't have access to this file");
    }

    workspace.delete(fileId);
    fileStorage.set(workspaceId, workspace);

    success(res, null, 200, "File deleted successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/files
 * @desc    List files in workspace
 * @access  Private
 */
router.get("/", authenticate, (req, res, next) => {
  try {
    const { workspaceId, folderId } = req.query;

    if (!workspaceId) {
      return badRequest(res, "Workspace ID required");
    }

    const workspace = fileStorage.get(workspaceId);

    if (!workspace) {
      return success(res, { files: [] });
    }

    let files = Array.from(workspace.values());

    // Filter by folder
    if (folderId) {
      files = files.filter(f => f.folderId === folderId);
    }

    // Filter root files
    if (folderId === null || folderId === undefined) {
      files = files.filter(f => f.folderId === null);
    }

    // Return without content to reduce payload
    const filesSummary = files.map(({ content, ...rest }) => rest);

    success(res, { files: filesSummary });
  } catch (err) {
    next(err);
  }
});

export default router;
