# VOID — A Browser IDE That Ships With a Claude Agent, a Colab GPU, and Real-Time Collab

> **Monaco editor + terminal + Claude AI agent + Colab T4 GPU gateway + Automerge CRDT collab + Google Drive sync + VS Code extension marketplace — all in one Node.js process. Open a URL, get a full cloud IDE with a GPU on tap.**

<p align="center"><img src="assets/hero.gif" alt="VOID IDE — Claude agent + Colab GPU" width="720"></p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/Danush-Aries/voidspace/ci.yml?branch=main&style=flat-square" alt="build">
  <img src="https://img.shields.io/badge/license-MIT-00ff41?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/made%20with-TypeScript%205.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="ts">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="react">
  <img src="https://img.shields.io/badge/Node-20%2B-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="node">
</p>

## Why this exists

Codespaces costs money after two hours a day. Colab has a T4 but no editor. VS Code Web has an editor but no GPU. VOID is what happens when you stop paying for three tools and glue them together: a Monaco editor in the browser, a Node/Express backend that speaks to a Colab kernel over its Jupyter HTTP API for real 4–12-hour T4 sessions, a Claude agent panel that streams responses and edits files, and a CRDT collab layer so two people can edit the same file with no merge conflicts. Auth + billing tiers included so you can host it yourself.

## Try it in 60 seconds

```bash
git clone https://github.com/Danush-Aries/voidspace.git
cd voidspace
npm install

cp .env.example .env
# Required: ANTHROPIC_API_KEY, JWT_SECRET (run: openssl rand -hex 64)

npm run dev                # http://localhost:3000
npm run marketplace:dev    # optional — extensions on :3001
```

Docker: `docker compose up --build`. Prod monitoring stack: `docker compose -f docker-compose.yml -f docker-compose.monitor.yml up -d` for Prometheus + Grafana + Loki.

## How it works

- **`server.ts`** — Express + Socket.IO + Vite dev middleware in one process; single-port dev, one binary in prod.
- **Gateway manager (`src/services/gatewayManager.ts`)** routes each `/api/execute/code` call to Local / SSH / Docker / Colab based on the payload's `gateway` field. Colab sessions are managed by `colabSessionManager.ts` with auto-shutdown timers so you don't leak GPUs.
- **Colab bridge (`src/services/colabKernelBridge.ts`)** — talks to the Jupyter HTTP API on a live Colab runtime; `aiColabOrchestrator.ts` lets Claude spin sessions on demand.
- **CRDT collab (`src/collab/`)** — Automerge documents, Socket.IO rooms per file, presence indicators, invite tokens, offline change queue. Two clients editing the same character position both survive.
- **Extension marketplace (`src/marketplace/Server.ts`)** — standalone Express server on `MARKETPLACE_PORT`; VS Code-compatible extension registry with search, ratings, install.
- **Auth (`src/services/authService.ts`)** — bcrypt + JWT + Google OAuth 2.0, in-memory `Map` in dev, swap-out interface for Postgres in prod.

## Screenshots

| Monaco + Claude panel | Colab GPU session | Real-time collab | Extension marketplace |
|---|---|---|---|
| ![](assets/screenshot-1.png) | ![](assets/screenshot-2.png) | ![](assets/screenshot-3.png) | ![](assets/screenshot-4.png) |

## Environment

Required:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — [get one here](https://console.anthropic.com) |
| `JWT_SECRET` | Random secret for signing JWTs — run `openssl rand -hex 64` |

Optional:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (enables Google login + Drive sync) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (default: `http://localhost:3000/api/auth/google/callback`) |
| `GEMINI_API_KEY` | Google Gemini API key (optional secondary model) |
| `PORT` | Server port (default: `3000`) |
| `MARKETPLACE_PORT` | Extension marketplace port (default: `3001`) |

## Usage examples

### AI Chat

Open the **AI Chat** panel — the agent streams a response directly from Claude:
```
You: Explain this Python function and suggest optimizations.
VOID: [streaming Claude response]
```

### Code Execution via Colab

```bash
curl -X POST http://localhost:3000/api/execute/code \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code": "print(2 + 2)", "language": "python", "gateway": "colab"}'
```

### Auth API

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "password123", "name": "Your Name"}'
```

## Project structure

```
voidspace/
├── server.ts                  # Express + Socket.IO entry point
├── src/
│   ├── App.tsx                # Root React component
│   ├── store.ts               # Zustand global state
│   ├── components/            # React UI components (CodeEditor, Terminal, AIChat, ...)
│   ├── services/              # authService, colabSessionManager, gatewayManager, googleDriveSync, ...
│   ├── collab/                # CRDT collaboration layer
│   ├── crdt/                  # Automerge CRDT documents
│   ├── extensions/            # Extension host and sandbox
│   ├── marketplace/Server.ts  # Extension registry server
│   ├── ws/                    # WebSocket server
│   └── __tests__/             # Vitest unit tests
├── .env.example
├── vite.config.ts
├── Dockerfile
└── docker-compose.yml
```

## Stack

**Frontend:** React 19, TypeScript, Tailwind CSS v4, Monaco Editor, xterm.js, Zustand.
**Backend:** Node 20, Express, Socket.IO, tsx.
**AI:** `@anthropic-ai/sdk` (streaming Claude).
**Collab:** Automerge CRDT.
**Execution:** Colab (Jupyter HTTP API), Docker, SSH.
**Auth:** bcrypt, JWT, Google OAuth 2.0.
**Cloud sync:** Google Drive API v3.
**Build/test:** Vite 6, esbuild, Vitest.

## Production notes

- **JWT_SECRET** must be set to a strong random value in production — the server will refuse to start without it.
- The in-memory user store in `authService.ts` is intentional for local and dev use. For production, replace the `Map` with a Postgres (or other) database adapter.
- Google Colab sessions require a valid Google access token with Drive scopes. Sessions auto-shutdown after 12 hours.
- The extension marketplace is a standalone Express server; run it on `MARKETPLACE_PORT` (default `3001`) alongside the main server.

## Contributing

PRs welcome. New execution gateways implement the `Gateway` interface in `src/services/gatewayManager.ts` — one `execute(code, opts) → { stdout, stderr, exit }` method and it slots into the router. Slash-command skills live in `src/services/skillRegistry.ts`.

## License

MIT — see [LICENSE](./LICENSE). Production notes and Cloud Run / Terraform recipes in [`deploy/README.md`](deploy/README.md).

---

### More from Danush

- [ponytail-for-python](https://github.com/Danush-Aries/ponytail-for-python) — code intelligence for Python codebases
- [Agentic_Systems](https://github.com/Danush-Aries/Agentic_Systems) — reference implementations of agent patterns
- [autonomous-coding-agent](https://github.com/Danush-Aries/autonomous-coding-agent) — full-auto engineering agent
- [computer-use-agent](https://github.com/Danush-Aries/computer-use-agent) — Claude drives your desktop via VNC
- [browser-automation-agent](https://github.com/Danush-Aries/browser-automation-agent) — Claude drives Playwright
- [blinkchat](https://github.com/Danush-Aries/blinkchat) — realtime chat with vibes
