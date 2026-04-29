# VOID Cloud IDE - Agent Reference Guide

## Development Commands
- `npm run dev` - Start development server (tsx server.ts)
- `npm run build` - Build for production (vite build)
- `npm run preview` - Preview production build (vite preview)
- `npm run lint` - TypeCheck only (tsc --noEmit)
- `npm run marketplace` - Start marketplace server (node marketplace-server.js)
- `npm run marketplace:dev` - Start marketplace server with watch (node --watch marketplace-server.js)

## Environment Variables (from .env.template)
**Required:**
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `ANTHROPIC_API_KEY` - Anthropic API Key for AI features
- `JWT_SECRET` - Secret for JWT tokens (min 32 chars)
- `SESSION_SECRET` - Secret for session encryption (min 32 chars)
- `GEMINI_API_KEY` - Google Gemini API Key

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql://void:void@postgres:5432/void)
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)

**Redis:**
- `REDIS_URL` - Redis connection string (default: redis://redis:6379)
- `REDIS_PORT` - Redis port (default: 6379)

**Application:**
- `NODE_ENV` - Environment (development/production)
- `APP_PORT` - Application port (default: 3000)
- `HOST` - Host binding (default: 0.0.0.0)
- `DOMAIN` - Application domain
- `WILDCARD_DOMAIN` - Wildcard domain for subdomains

**Monitoring:**
- `GRAFANA_PASSWORD` - Grafana admin password
- `GRAFANA_PLUGINS` - Comma-separated list of Grafana plugins

**Email (optional):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`

**Development:**
- `DEV_MODE` - Enable development features
- `ENABLE_PROFILING` - Enable performance profiling

## Docker Compose Services
Defined in `docker-compose.yml`:
- **app** - Main Node.js application (builds from Dockerfile)
- **postgres** - PostgreSQL 16-alpine database
- **redis** - Redis 7-alpine cache and session store
- **nginx** - Reverse proxy serving static assets and handling SSL
- **prometheus** - Metrics collection and storage
- **grafana** - Metrics visualization dashboard
- **loki** - Log aggregation system
- **promtail** - Log shipping agent
- **pgadmin** - PostgreSQL administration UI (tools profile)
- **mailhog** - Email testing utility (dev profile)

Networks: `void-network` (bridge)
Volumes: Persistent storage for all stateful services

## Architecture Boundaries

### Services Layer (`src/services/`)
- `googleAuth.js` - Google OAuth2 authentication flow
- `googleDriveSync.js` - Google Drive file synchronization
- `headlessBrowser.js` - Puppeteer/Puppeteer-core browser automation
- `authService.js` - Local authentication (JWT, sessions)
- `gatewayManager.js` - Manages external service gateways (SSH, Docker, etc.)
- `sessionStorage.js` - Session management interface
- `colabSessionManager.js` - Collaborative session lifecycle
- `colabKernelBridge.ts` - Jupyter kernel communication bridge
- `crdt.ts` - Conflict-free Replicated Data Type implementation
- `sessionManager.js` - User session handling
- `browserAutomation.ts` - High-level browser automation APIs
- `aiCompletion.ts` - AI code completion service
- `syncEngine.js` - Data synchronization engine
- `driveAutoConfig.ts` - Google Drive auto-configuration

### Gateway Layer (`src/gateways/`)
- Base gateway implementations for:
  - Docker container management
  - SSH connections
  - Plugin system
  - Monitoring integrations
  - Colab environment connections

### Collaboration/CRDT Layer (`src/collab/`, `src/crdt/`)
- `collaboration-manager.ts` - Orchestrates collaborative editing
- `event-bus.ts` - Central event publishing/subscription system
- `presence-manager.ts` - User presence and cursor tracking
- `room-manager.ts` - Collaboration room management
- `operational-transformer.ts` - Operational Transform implementation
- `crdt-document.ts` - CRDT document model
- `index.ts` - Public collaboration APIs

### Websocket/AI/Editor/Routes/Middleware Layers
- **WebSocket** (`src/ws/`) - Real-time communication layer
  - `socket.ts` - Socket.IO server wrapper
  - `events.ts` - Event definitions and handlers
  - `server.js` - WebSocket server initialization
  
- **AI** (`src/ai/`) - Artificial intelligence integration
  - `chat.js` - AI chat interface
  - `completion.js` - Code completion service
  - `copilot.js` - AI pair programming assistant
  - `config/prompts.js` - AI prompt templates
  - `utils/contextManager.js` - Context management for AI
  - `utils/tokenTracker.js` - Token usage tracking
  
- **Editor** (`src/editor/`, `src/components/`)
  - `MonacoSetup.js` - Monaco editor initialization
  - Various React components for editor UI
  
- **Routes** (`src/routes/`) - REST API endpoints
  - `index.js` - Main route aggregator
  - `auth.js` - Authentication endpoints
  - `files.js` - File system operations
  - `sessions.js` - Session management
  - `workspaces.js` - Workspace operations
  - `ai.js` - AI-related endpoints
  - `gateway.js` - External service gateways
  
- **Middleware** (`src/middleware/`) - Express middleware
  - `auth.js` - Authentication verification
  - `errorHandler.js` - Centralized error handling
  - `validation.js` - Request validation
  - `rateLimit.js` - Rate limiting
  - `security.js` - Security headers and protections

## Event-Driven Collaboration Flow
1. User action triggers event via `event-bus.ts`
2. Event published to relevant collaborators through WebSocket connections
3. Remote clients receive event and update local CRDT state
4. CRDT automatically resolves conflicts and converges state
5. UI updates through React state changes from CRDT observers
6. Presence and cursor updates sent separately via presence-manager
7. All state changes persisted to sessionStorage and synchronized periodically

## Testing Notes
- **Type Checking**: `npm run lint` uses `tsc --noEmit` for type validation
- **End-to-End**: Playwright tests would be located in `tests/` directory (not yet present)
- **Marketplace**: Separate server for testing marketplace integrations
- **Environment**: Tests should use `.env.test` or similar for isolated configuration
- **Database**: Integration tests require PostgreSQL and Redis instances
- **Mocking**: External services (Google, Anthropic) should be mocked in unit tests

## Critical Gotchas

### OAuth & Authentication
- **Google Redirect URIs**: Must match exactly in Google Cloud Console:
  - `http://localhost:3000/auth/google/callback`
  - `https://yourdomain.com/auth/google/callback`
- **Drive Scopes**: Requires `https://www.googleapis.com/auth/drive.file` scope
- **JWT Secret**: Must be consistent across all instances; changing invalidates all sessions
- **Session Storage**: Currently uses in-memory Redis; data lost on Redis restart

### Routing Issues
- **Duplicate Routes**: Check `server.ts` lines 308-340 and 802-835 for conflicting route definitions
- **Route Order**: Express routes are matched in order; more specific routes must come first

### Browser Automation
- **Playwright Binaries**: Requires `npx playwright install` to download browsers
- **Headless Mode**: `headlessBrowser.js` runs in headless mode by default; set `HEADLESS=false` for debug

### File System & Storage
- **Uploads**: Files stored in `./uploads` directory; ensure volume mounted in Docker
- **Temporary Files**: Cleanup mechanisms may not be automatic; monitor disk usage

### Environment Specific
- **Development vs Production**: `NODE_ENV` affects logging, error details, and feature flags
- **Proxy Headers**: Behind Nginx, trust proxy settings required for correct IP detection
- **WebSocket Proxies**: Nginx must be configured for WebSocket upgrade headers

## Key Dependencies
- **Framework**: React 19, Vite 6, Express 4
- **State Management**: Zustand 5
- **Real-time**: Socket.IO 4
- **Editor**: @monaco-editor/react 4.7
- **CRDT**: Automerge 2.2
- **AI**: @anthropic-ai/sdk 0.8, @google/genai 1.29
- **Google**: googleapis 142, google-auth-library 9
- **Browser**: Playwright 1.48, xterm 5.3
- **Utilities**: Lodash (via clsx, uuid), Axios, Multer, SSH2
- **Dev**: TypeScript 5.8, TSX 4.21, TailwindCSS 4 via Vite plugin

## File Structure Highlights
```
/src
  /services        # Business logic layer
  /gateways        # External service adapters
  /collab          # Collaboration managers and event bus
  /crdt            # CRDT implementation
  /ws              # WebSocket server and events
  /ai              # AI service integrations
  /routes          # REST API controllers
  /middleware      # Express middleware
  /components      # React UI components
  /editor          # Monaco editor setup
  /extensions      # VS Code extension compatibility
  /marketplace     # Marketplace client and server
  /types           # TypeScript type definitions
  /store           # Zustand stores
  /config          # Configuration loading
  /lib             # Utility functions
  /assets          # Static assets (if any)

/deploy            # Deployment scripts and configs
/monitoring        # Prometheus, Grafana, Loki configs
/nginx             # Nix configuration
```

## Existing Configuration Sources
- `.env.template` - Environment variable template
- `docker-compose.yml` - Multi-service container orchestration
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript compiler options
- `cloudbuild.yaml` - Google Cloud Build configuration
- `nginx/nginx.conf` - Base Nginx configuration
- `deploy/init.sql` - Database initialization script
- `package.json` - Dependencies and scripts
- `index.html` - Entry point HTML template