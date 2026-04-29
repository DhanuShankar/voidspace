export default {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "voidspace-secret-key-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // requests per window per IP
    skipSuccessfulRequests: false,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  },

  // Upload
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedFileTypes: [".txt", ".js", ".ts", ".py", ".json", ".md", ".html", ".css", ".yml", ".yaml"],
  },

  // WebSocket
  websocket: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    heartbeatInterval: 25000,
    heartbeatTimeout: 60000,
  },

  // Security
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "trusted-cdn.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    },
  },

  // API Documentation
  api: {
    title: "VoidSpace API",
    description: "Real-time collaborative cloud IDE API",
    version: "1.0.0",
  },

  // Services
  services: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
};
