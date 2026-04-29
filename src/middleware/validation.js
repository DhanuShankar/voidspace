import Joi from "joi";
import { validationError } from "../utils/response.js";

/**
 * Validate request body against schema
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return validationError(res, errors);
    }

    next();
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return validationError(res, errors);
    }

    next();
  };
};

/**
 * Validate URL parameters
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return validationError(res, errors);
    }

    next();
  };
};

// ============ Common Schemas ============

export const schemas = {
  // Auth
  signup: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).max(100).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  // Files
  fileUpload: Joi.object({
    fileName: Joi.string().required(),
    fileType: Joi.string().valid("file", "folder").required(),
    parentId: Joi.string().uuid().optional(),
  }),

  // Workspace
  workspaceCreate: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    template: Joi.string().optional(),
  }),

  // Code execution
  codeExecution: Joi.object({
    code: Joi.string().required(),
    language: Joi.string().valid("python", "javascript", "typescript", "bash", "r", "julia").required(),
    gateway: Joi.string().valid("colab", "local", "docker").optional(),
  }),

  // AI Chat
  aiChat: Joi.object({
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid("user", "assistant", "system").required(),
        content: Joi.string().required(),
      })
    ).min(1).required(),
    system: Joi.string().optional(),
    model: Joi.string().optional(),
  }),

  // Drive
  driveInit: Joi.object({
    accessToken: Joi.string().required(),
  }),

  sessionData: Joi.object({
    name: Joi.string().required(),
    content: Joi.any().required(),
  }),

  // Colab
  colabSession: Joi.object({
    accessToken: Joi.string().required(),
    workspaceName: Joi.string().optional(),
    enableGPU: Joi.boolean().optional(),
  }),

  // Gateway
  gatewayActivate: Joi.object({
    name: Joi.string().required(),
  }),
};
