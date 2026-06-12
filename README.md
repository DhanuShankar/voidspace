# VOID — Vibe-Operated Intelligent Developer

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/Node.js-20%2B-brightgreen?logo=node.js)

VOID is a fully AI-powered, browser-based IDE. It ships a Monaco editor, an integrated terminal emulator, real-time multi-user collaboration via CRDT + Socket.IO, a Claude-powered AI agent, a Google Colab execution gateway with T4 GPU access, Google Drive sync, and a VS Code-compatible extension marketplace — all in a single Node.js process.

---

## Features

- **Monaco Editor** — the same engine that powers VS Code, with syntax highlighting, IntelliSense stubs, and tab management
- **Claude AI Agent** — streaming chat and in-editor completions powered by Anthropic's Claude API
- **Google Colab Gateway** — execute Python code on a remote Colab T4 GPU runtime (4–12-hour sessions), with auto-shutdown timers and session metrics
- **Multi-Gateway Execution** — route code to Local, SSH, Docker, or Colab runners; the gateway manager picks the best backend for the task
- **Real-Time Collaboration** — CRDT-based document sync via Automerge + Socket.IO, with presence indicators, invite tokens, and offline-change queuing
- **Google Drive Sync** — automatic workspace backup and notebook export to Google Drive
- **Extension Marketplace** — install, search, rate, and manage VS Code-compatible extensions from a built-in registry server
- **Integrated Terminal** — xterm.js terminal panel wired to the backend via WebSockets
- **Auth System** — email/password signup and Google OAuth, with JWT sessions and free/pro/enterprise plans
- **Skill System** — slash-command skill registry for common Colab/Drive/GPU operations
- **Responsive UI** — full desktop IDE layout and a mobile-friendly bottom-nav view
- **Live Preview** — side-by-side browser preview panel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Monaco Editor, xterm.js, Zustand |
| Backend | Node.js, Express, Socket.IO, tsx |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Collaboration | Automerge CRDT, Socket.IO rooms |
| Execution | Google Colab (Jupyter HTTP API), Docker, SSH |
| Auth | bcrypt, JSON Web Tokens, Google OAuth 2.0 |
| Cloud Sync | Google Drive API v3 |
| Build | Vite 6, esbuild |
| Tests | Vitest |

---

## Installation

### Prerequisites

- Node.js 20 or later
- npm 10 or later

### Clone and install

```bash
git clone <repo-url> voidspace
cd voidspace
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env and fill in the required values (see below)
```

Required variables:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — [get one here](https://console.anthropic.com) |
| `JWT_SECRET` | Random secret for signing JWTs — run `openssl rand -hex 64` |

Optional variables:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (enables Google login + Drive sync) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (default: `http://localhost:3000/api/auth/google/callback`) |
| `GEMINI_API_KEY` | Google Gemini API key (optional secondary model) |
| `PORT` | Server port (default: `3000`) |
| `MARKETPLACE_PORT` | Extension marketplace port (default: `3001`) |

---

## Running in Development

Start the main server (Express + Vite dev middleware + Socket.IO):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Start the extension marketplace server separately (optional):

```bash
npm run marketplace:dev
```

---

## Running in Production

```bash
npm run build          # Build the React frontend into dist/
NODE_ENV=production npm run dev   # Serve the compiled bundle
```

Or with Docker:

```bash
docker compose up --build
```

---

## Usage Examples

### AI Chat

In the IDE, open the **AI Chat** panel (right sidebar or bottom-nav on mobile).
Ask anything — the agent streams a response directly from Claude:

```
You: Explain this Python function and suggest optimizations.
VOID: [streaming response from Claude claude-3-5-sonnet-20240620]
```

### Code Execution via Colab

1. Click **Cloud Setup** in the header.
2. Enter your Google access token and enable GPU.
3. Run code via the **Execute** API endpoint or the terminal:

```bash
curl -X POST http://localhost:3000/api/execute/code \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code": "print(2 + 2)", "language": "python", "gateway": "colab"}'
```

### Auth API

```bash
# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "password123", "name": "Your Name"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "password123"}'
```

### Extension Marketplace

```bash
# Search extensions
curl http://localhost:3001/api/extensions/search?q=python

# Get featured extensions
curl http://localhost:3001/api/extensions/featured
```

---

## Project Structure

```
voidspace/
├── server.ts                  # Express + Socket.IO entry point
├── src/
│   ├── App.tsx                # Root React component (landing + IDE)
│   ├── store.ts               # Zustand global state
│   ├── main.tsx               # Vite entry point
│   ├── components/            # React UI components
│   │   ├── CodeEditor.tsx     # Monaco editor wrapper
│   │   ├── Terminal.tsx       # xterm.js terminal
│   │   ├── AIChat.tsx         # Claude chat panel
│   │   ├── FileExplorer.tsx   # File tree
│   │   ├── ExtensionsPanel.tsx
│   │   └── ...
│   ├── services/              # Backend services (TypeScript)
│   │   ├── authService.ts     # JWT auth + user management
│   │   ├── colabSessionManager.ts  # Colab session lifecycle
│   │   ├── colabKernelBridge.ts    # Jupyter HTTP client
│   │   ├── gatewayManager.ts  # Multi-gateway execution router
│   │   ├── googleAuth.ts      # Google OAuth 2.0
│   │   ├── googleDriveSync.ts # Drive backup/restore
│   │   ├── skillRegistry.ts   # Slash-command skills
│   │   └── aiColabOrchestrator.ts  # AI-driven session management
│   ├── collab/                # CRDT collaboration layer
│   │   ├── collaboration-manager.ts
│   │   ├── room-manager.ts
│   │   ├── presence-manager.ts
│   │   └── event-bus.ts
│   ├── crdt/                  # Automerge CRDT documents
│   ├── extensions/            # Extension host and sandbox
│   ├── marketplace/           # Extension registry server
│   │   └── Server.ts
│   ├── ws/                    # WebSocket server
│   └── __tests__/             # Vitest unit tests
├── marketplace-server.js      # Marketplace server entry shim
├── .env.example               # Environment variable template
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

---

## Running Tests

```bash
npm test
```

Tests use **Vitest** and run against the TypeScript source directly (no pre-compilation needed).

---

## Production Notes

- **JWT_SECRET** must be set to a strong random value in production — the server will refuse to start without it.
- The in-memory user store in `authService.ts` is intentional for local and dev use. For production, replace the `Map` with a Postgres (or other) database adapter.
- Google Colab sessions require a valid Google access token with Drive scopes. Sessions auto-shutdown after 12 hours.
- The extension marketplace is a standalone Express server; run it on `MARKETPLACE_PORT` (default `3001`) alongside the main server.

---

## Deployment

A production-ready `Dockerfile` and `docker-compose.yml` are included. See [`deploy/README.md`](deploy/README.md) for Cloud Run and Terraform deployment instructions.

```bash
# Build and start with Docker Compose
docker compose up --build -d

# Include monitoring stack (Prometheus + Grafana + Loki)
docker compose -f docker-compose.yml -f docker-compose.monitor.yml up -d
```

---

## License

MIT
