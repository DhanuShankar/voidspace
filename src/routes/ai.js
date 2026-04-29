import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { success, error } from "../utils/response.js";

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

/**
 * System prompts for code assistance
 */
const SYSTEM_PROMPTS = {
  default: `You are an expert coding assistant helping developers write better code.
You provide concise, accurate, and helpful responses. When writing code:
- Write clean, well-documented code
- Follow language-specific best practices
- Include error handling where appropriate
- Explain complex decisions briefly
- Use modern language features
Focus on practical solutions.`,

  review: `You are a senior code reviewer. Analyze code for:
- Bugs and edge cases
- Performance issues
- Security vulnerabilities
- Code style and readability
- Architecture concerns
Provide specific, actionable feedback.`,

  debug: `You are a debugging expert. Help identify and fix bugs:
- Analyze error messages and stack traces
- Suggest root causes
- Provide step-by-step debugging approach
- Offer fixes with explanations
- Consider edge cases`,

  refactor: `You are a refactoring specialist. Improve code by:
- Reducing complexity
- Improving readability
- Applying design patterns
- Removing duplication
- Enhancing maintainability
Explain each change and its benefit.`,
};

/**
 * @route   POST /api/ai/chat
 * @desc    Chat with AI assistant
 * @access  Private
 */
router.post("/chat", authenticate, validate(schemas.aiChat), async (req, res, next) => {
  try {
    const { messages, system, model = "claude-3-5-sonnet-20240620" } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, { message: "AI service not configured" }, 503);
    }

    const systemPrompt = system || SYSTEM_PROMPTS.default;

    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Set up streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        } else if (event.type === "message_stop") {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
      }
      res.end();
    } catch (streamErr) {
      res.end();
      throw streamErr;
    }
  } catch (err) {
    console.error("AI Chat Error:", err);
    if (!res.headersSent) {
      error(res, { message: "AI service error: " + err.message }, 500);
    }
  }
});

/**
 * @route   POST /api/ai/complete
 * @desc    Get code completion
 * @access  Private
 */
router.post("/complete", authenticate, validate(schemas.codeCompletion), async (req, res, next) => {
  try {
    const { code, language, context, instruction } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, { message: "AI service not configured" }, 503);
    }

    const prompt = instruction || `Complete the following ${language} code:\n\n${code}`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: context
            ? `Context/requirements:\n${context}\n\nCode to complete:\n${code}`
            : prompt,
        },
      ],
    });

    const completion = message.content[0].text;

    success(res, { completion, language }, 200, "Code completed successfully");
  } catch (err) {
    console.error("AI Complete Error:", err);
    error(res, { message: "AI service error: " + err.message }, 500);
  }
});

/**
 * @route   POST /api/ai/review
 * @desc    Get code review
 * @access  Private
 */
router.post("/review", authenticate, (req, res, next) => {
  try {
    const { code, language, focus } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, { message: "AI service not configured" }, 503);
    }

    const systemPrompt = `${SYSTEM_PROMPTS.review}` +
      (focus ? `\nFocus areas: ${focus.join(", ")}` : "");

    anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please review this ${language} code:\n\n${code}`,
        },
      ],
    })
      .then((response) => {
        const review = response.content[0].text;

        success(res, {
          review,
          language,
          issuesFound: countIssues(review),
        });
      })
      .catch((err) => {
        error(res, { message: "AI service error: " + err.message }, 500);
      });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/ai/debug
 * @desc    Get debugging assistance
 * @access  Private
 */
router.post("/debug", authenticate, (req, res, next) => {
  try {
    const { code, errorMessage, stackTrace, language } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, { message: "AI service not configured" }, 503);
    }

    const prompt = `I need help debugging ${language} code.\n\n` +
      `Code:\n${code}\n\n` +
      (errorMessage ? `Error: ${errorMessage}\n\n` : "") +
      (stackTrace ? `Stack trace:\n${stackTrace}\n\n` : "") +
      `Please help identify the issue and suggest a fix.`;

    anthropic.messages
      .create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2048,
        system: SYSTEM_PROMPTS.debug,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      })
      .then((response) => {
        const analysis = response.content[0].text;

        success(res, {
          analysis,
          suggestions: extractSuggestions(analysis),
        });
      })
      .catch((err) => {
        error(res, { message: "AI service error: " + err.message }, 500);
      });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/ai/refactor
 * @desc    Get refactoring suggestions
 * @access  Private
 */
router.post("/refactor", authenticate, (req, res, next) => {
  try {
    const { code, language, goals } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, { message: "AI service not configured" }, 503);
    }

    const systemPrompt = `${SYSTEM_PROMPTS.refactor}` +
      (goals ? `\nRefactoring goals: ${goals.join(", ")}` : "");

    anthropic.messages
      .create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Refactor this ${language} code:\n\n${code}`,
          },
        ],
      })
      .then((response) => {
        const refactored = response.content[0].text;

        success(res, { refactored, language });
      })
      .catch((err) => {
        error(res, { message: "AI service error: " + err.message }, 500);
      });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/ai/models
 * @desc    List available AI models
 * @access  Private
 */
router.get("/models", authenticate, (req, res) => {
  success(res, {
    models: [
      {
        id: "claude-3-5-sonnet-20240620",
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        contextWindow: 200000,
        capabilities: ["chat", "code", "analysis"],
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        provider: "anthropic",
        contextWindow: 200000,
        capabilities: ["chat", "code", "analysis", "reasoning"],
      },
    ],
  });
});

/**
 * Helper: Count issues in review (simple heuristic)
 */
function countIssues(review) {
  const issueKeywords = ["bug", "error", "security", "performance", "vulnerability", "warning", "issue"];
  let count = 0;
  review.toLowerCase().split(".").forEach((sentence) => {
    issueKeywords.forEach((keyword) => {
      if (sentence.includes(keyword)) count++;
    });
  });
  return Math.min(count, 10); // Cap at 10
}

/**
 * Helper: Extract suggestions from analysis
 */
function extractSuggestions(analysis) {
  const suggestions = [];
  const lines = analysis.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\./.test(trimmed)) {
      suggestions.push(trimmed);
    }
  });

  return suggestions.slice(0, 5); // Return up to 5 suggestions
}

export default router;
