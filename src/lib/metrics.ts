import { Router } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';

// ============================================================================
# Prometheus Metrics Collection Middleware
# ============================================================================

// Create a registry
const register = new promClient.Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

const colabSessionsActive = new Gauge({
  name: 'colab_sessions_active',
  help: 'Number of active Colab sessions',
  labelNames: ['runtime'],
  registers: [register],
});

const colabSessionDuration = new Histogram({
  name: 'colab_session_duration_seconds',
  help: 'Duration of Colab sessions in seconds',
  labelNames: ['status'],
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 43200],
  registers: [register],
});

const codeExecutionsTotal = new Counter({
  name: 'code_executions_total',
  help: 'Total number of code executions',
  labelNames: ['language', 'gateway', 'status'],
  registers: [register],
});

const codeExecutionDuration = new Histogram({
  name: 'code_execution_duration_seconds',
  help: 'Duration of code executions in seconds',
  labelNames: ['language', 'gateway'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

const aiRequestsTotal = new Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['model', 'endpoint', 'status'],
  registers: [register],
});

const usersOnline = new Gauge({
  name: 'users_online',
  help: 'Number of users currently online',
  registers: [register],
});

// ============================================================================
# Middleware Functions
# ============================================================================

export function metricsMiddleware(req: any, res: any, next: () => void) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
}

export function updateActiveConnections(count: number) {
  activeConnections.set(count);
}

export function updateColabSessions(active: number, runtime: string = 't4') {
  colabSessionsActive.labels(runtime).set(active);
}

export function recordColabSessionDuration(status: string, duration: number) {
  colabSessionDuration.labels(status).observe(duration);
}

export function recordCodeExecution(language: string, gateway: string, status: string) {
  codeExecutionsTotal.labels(language, gateway, status).inc();
}

export function recordExecutionDuration(language: string, gateway: string, duration: number) {
  codeExecutionDuration.labels(language, gateway).observe(duration);
}

export function recordAIRequest(model: string, endpoint: string, status: string) {
  aiRequestsTotal.labels(model, endpoint, status).inc();
}

export function updateUsersOnline(count: number) {
  usersOnline.set(count);
}

// ============================================================================
# Metrics Endpoint
# ============================================================================

export function setupMetricsRoutes(app: any) {
  const router = Router();

  // Metrics endpoint for Prometheus
  router.get('/metrics', async (req: res) => {
    try {
      const metrics = await register.metrics();
      res.set('Content-Type', register.contentType);
      res.send(metrics);
    } catch (err) {
      res.status(500).end(err);
    }
  });

  // Health check endpoint
  router.get('/health', (req: res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
    };

    res.json(health);
  });

  // Detailed health check with dependencies
  router.get('/health/detailed', async (req: res) => {
    // Add detailed health checks here
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Check database
    try {
      // Add actual DB check
      health.services.database = { status: 'healthy' };
    } catch (err) {
      health.services.database = { status: 'unhealthy', error: err.message };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      // Add actual Redis check
      health.services.redis = { status: 'healthy' };
    } catch (err) {
      health.services.redis = { status: 'unhealthy', error: err.message };
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Readiness probe (for Kubernetes)
  router.get('/ready', (req: res) => {
    // Check if app is ready to serve traffic
    res.status(200).json({ ready: true });
  });

  // Liveness probe (for Kubernetes)
  router.get('/live', (req: res) => {
    res.status(200).json({ alive: true });
  });

  app.use('/api', router);
}

// ============================================================================
# Export metrics manually for registration
# ============================================================================

export const metrics = {
  httpRequestCount: httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  colabSessionsActive,
  colabSessionDuration,
  codeExecutionsTotal,
  codeExecutionDuration,
  aiRequestsTotal,
  usersOnline,
  register,
};
