import { Router } from "express";
import crypto from "crypto";
import { authenticate } from "../middleware/auth.js";
import { success, error, badRequest, notFound } from "../utils/response.js";

const router = Router();

/**
 * In-memory session storage (replace with database)
 */
const sessions = new Map();

/**
 * @route   POST /api/sessions
 * @desc    Create a new coding session
 * @access  Private
 */
router.post("/", authenticate, (req, res, next) => {
  try {
    const { name, workspaceId, gateway = "colab", metadata } = req.body;

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session = {
      sessionId,
      name: name || "Untitled Session",
      workspaceId: workspaceId || null,
      userId: req.userId,
      gateway,
      status: "active",
      startedAt: now,
      lastActivity: now,
      metadata: metadata || {},
      statistics: {
        executions: 0,
        totalTime: 0,
        filesSaved: 0,
        collaborators: 1,
      },
    };

    sessions.set(sessionId, session);

    success(res, session, 201, "Session created successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/sessions
 * @desc    List user's sessions
 * @access  Private
 */
router.get("/", authenticate, (req, res, next) => {
  try {
    const { workspaceId, status, limit = 20, offset = 0 } = req.query;

    const userSessions = [];

    for (const session of sessions.values()) {
      if (session.userId === req.userId) {
        if (workspaceId && session.workspaceId !== workspaceId) continue;
        if (status && session.status !== status) continue;

        userSessions.push(session);
      }
    }

    // Sort by last activity
    userSessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    const paginated = userSessions.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    success(res, {
      sessions: paginated,
      total: userSessions.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/sessions/:sessionId
 * @desc    Get session details
 * @access  Private
 */
router.get("/:sessionId", authenticate, (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (!session) {
      return notFound(res, "Session not found");
    }

    // Check ownership
    if (session.userId !== req.userId) {
      return forbidden(res, "You don't have access to this session");
    }

    success(res, session);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/sessions/:sessionId
 * @desc    Update session
 * @access  Private
 */
router.put("/:sessionId", authenticate, (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { name, status, metadata } = req.body;

    const session = sessions.get(sessionId);

    if (!session) {
      return notFound(res, "Session not found");
    }

    // Check ownership
    if (session.userId !== req.userId) {
      return forbidden(res, "You don't have access to this session");
    }

    // Update allowed fields
    if (name !== undefined) session.name = name;
    if (status !== undefined) session.status = status;
    if (metadata !== undefined) session.metadata = { ...session.metadata, ...metadata };

    session.updatedAt = new Date().toISOString();
    sessions.set(sessionId, session);

    success(res, session, 200, "Session updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Delete session
 * @access  Private
 */
router.delete("/:sessionId", authenticate, (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (!session) {
      return notFound(res, "Session not found");
    }

    // Check ownership
    if (session.userId !== req.userId) {
      return forbidden(res, "You don't have access to this session");
    }

    sessions.delete(sessionId);

    success(res, null, 200, "Session deleted successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/sessions/:sessionId/archive
 * @desc    Archive session
 * @access  Private
 */
router.post("/:sessionId/archive", authenticate, (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);

    if (!session) {
      return notFound(res, "Session not found");
    }

    // Check ownership
    if (session.userId !== req.userId) {
      return forbidden(res, "You don't have access to this session");
    }

    session.status = "archived";
    session.archivedAt = new Date().toISOString();
    sessions.set(sessionId, session);

    success(res, session, 200, "Session archived successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/sessions/:sessionId/execute
 * @desc    Execute code in session context
 * @access  Private
 */
router.post("/:sessionId/execute", authenticate, (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { code, language } = req.body;

    if (!code) {
      return badRequest(res, "Code is required");
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return notFound(res, "Session not found");
    }

    // Check ownership
    if (session.userId !== req.userId) {
      return forbidden(res, "You don't have access to this session");
    }

    // Update session activity
    session.lastActivity = new Date().toISOString();
    session.statistics.executions += 1;
    sessions.set(sessionId, session);

    // In production, execute code in appropriate gateway
    // Return mock success for now
    const result = {
      success: true,
      output: `Execution result for ${language} code\n`,
      executionTime: 0,
      timestamp: new Date().toISOString(),
    };

    success(res, result, 200, "Code executed successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/sessions/stats
 * @desc    Get session statistics
 * @access  Private
 */
router.get("/stats/summary", authenticate, (req, res, next) => {
  try {
    let totalSessions = 0;
    let activeSessions = 0;
    let totalExecutions = 0;
    let totalTime = 0;

    for (const session of sessions.values()) {
      if (session.userId === req.userId) {
        totalSessions++;
        if (session.status === "active") activeSessions++;
        totalExecutions += session.statistics.executions;
        totalTime += session.statistics.totalTime;
      }
    }

    const stats = {
      totalSessions,
      activeSessions,
      totalExecutions,
      totalExecutionTime: totalTime,
      averageSessionDuration: totalSessions > 0 ? totalTime / totalSessions : 0,
    };

    success(res, stats);
  } catch (err) {
    next(err);
  }
});

export default router;
