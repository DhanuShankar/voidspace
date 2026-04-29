import { Router } from "express";
import crypto from "crypto";
import { authenticate } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { success, error, badRequest, notFound, conflict } from "../utils/response.js";

const router = Router();

/**
 * In-memory workspace storage
 */
const workspaces = new Map();
const workspaceMembers = new Map();

/**
 * @route   POST /api/workspaces
 * @desc    Create a new workspace
 * @access  Private
 */
router.post("/", authenticate, validate(schemas.workspaceCreate), (req, res, next) => {
  try {
    const { name, description, template } = req.body;

    const workspaceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const workspace = {
      workspaceId,
      name,
      description: description || "",
      template: template || "blank",
      ownerId: req.userId,
      createdAt: now,
      updatedAt: now,
      settings: {
        autoSave: true,
        collaborators: "invite-only",
        terminalPersist: true,
      },
      statistics: {
        filesCount: 0,
        collaboratorsCount: 1,
        lastActivity: now,
      },
    };

    // Auto-add owner as member
    const members = new Map();
    members.set(req.userId, {
      userId: req.userId,
      role: "owner",
      joinedAt: now,
      permissions: ["read", "write", "admin"],
    });
    workspaceMembers.set(workspaceId, members);

    workspaces.set(workspaceId, workspace);

    success(res, workspace, 201, "Workspace created successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/workspaces
 * @desc    List user's workspaces
 * @access  Private
 */
router.get("/", authenticate, (req, res, next) => {
  try {
    const userWorkspaces = [];

    for (const [workspaceId, workspace] of workspaces.entries()) {
      if (workspace.ownerId === req.userId) {
        const members = workspaceMembers.get(workspaceId) || new Map();
        const collaboratorsCount = members.size;

        userWorkspaces.push({
          ...workspace,
          statistics: {
            ...workspace.statistics,
            collaboratorsCount,
          },
        });
      }
    }

    success(res, { workspaces: userWorkspaces });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/workspaces/:workspaceId
 * @desc    Get workspace details
 * @access  Private
 */
router.get("/:workspaceId", authenticate, (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    const workspace = workspaces.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    // Check access
    const members = workspaceMembers.get(workspaceId);
    const member = members?.get(req.userId);

    if (!member && workspace.ownerId !== req.userId) {
      return forbidden(res, "You don't have access to this workspace");
    }

    const membersList = Array.from(members?.values() || []);

    success(res, {
      ...workspace,
      members: membersList,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/workspaces/:workspaceId
 * @desc    Update workspace
 * @access  Private
 */
router.put("/:workspaceId", authenticate, (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, settings } = req.body;

    const workspace = workspaces.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    // Check ownership
    if (workspace.ownerId !== req.userId) {
      return forbidden(res, "Only owner can update workspace");
    }

    // Update fields
    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (settings !== undefined) workspace.settings = { ...workspace.settings, ...settings };
    workspace.updatedAt = new Date().toISOString();

    workspaces.set(workspaceId, workspace);

    success(res, workspace, 200, "Workspace updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/workspaces/:workspaceId
 * @desc    Delete workspace
 * @access  Private
 */
router.delete("/:workspaceId", authenticate, (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    const workspace = workspaces.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    // Check ownership
    if (workspace.ownerId !== req.userId) {
      return forbidden(res, "Only owner can delete workspace");
    }

    workspaces.delete(workspaceId);
    workspaceMembers.delete(workspaceId);

    success(res, null, 200, "Workspace deleted successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/workspaces/:workspaceId/invite
 * @desc    Invite user to workspace
 * @access  Private
 */
router.post("/:workspaceId/invite", authenticate, (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { email, role = "collaborator" } = req.body;

    const workspace = workspaces.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    // Check if user is owner
    if (workspace.ownerId !== req.userId) {
      return forbidden(res, "Only owner can invite users");
    }

    // In production, send invitation email
    // For now, just return success
    success(res, {
      workspaceId,
      invitedEmail: email,
      role,
      message: "Invitation sent",
    }, 200, "User invited successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/workspaces/:workspaceId/members/:userId
 * @desc    Remove member from workspace
 * @access  Private
 */
router.delete("/:workspaceId/members/:userId", authenticate, (req, res, next) => {
  try {
    const { workspaceId, userId } = req.params;

    const workspace = workspaces.get(workspaceId);

    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    // Check if user is owner
    if (workspace.ownerId !== req.userId) {
      return forbidden(res, "Only owner can remove members");
    }

    const members = workspaceMembers.get(workspaceId);
    if (members) {
      members.delete(userId);
    }

    success(res, null, 200, "Member removed successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/workspaces/:workspaceId/files
 * @desc    Get workspace file tree
 * @access  Private
 */
router.get("/:workspaceId/files", authenticate, (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    // Check access
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      return notFound(res, "Workspace not found");
    }

    const members = workspaceMembers.get(workspaceId);
    const hasAccess = workspace.ownerId === req.userId || members?.has(req.userId);

    if (!hasAccess) {
      return forbidden(res, "You don't have access to this workspace");
    }

    // Build file tree
    const filesWorkspace = fileStorage.get(workspaceId) || new Map();
    const files = Array.from(filesWorkspace.values()).map(({ content, ...rest }) => rest);

    // Organize into tree structure
    const tree = organizeIntoTree(files);

    success(res, { tree, files: files });
  } catch (err) {
    next(err);
  }
});

/**
 * Organize files into tree structure
 */
function organizeIntoTree(files) {
  const map = new Map();
  const roots = [];

  // First pass: create map
  files.forEach(file => {
    map.set(file.fileId, { ...file, children: [] });
  });

  // Second pass: build tree
  files.forEach(file => {
    if (file.folderId && map.has(file.folderId)) {
      map.get(file.folderId).children.push(map.get(file.fileId));
    } else {
      roots.push(map.get(file.fileId));
    }
  });

  return roots;
}

export default router;
