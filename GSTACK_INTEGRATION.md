# gstack Integration with VOID IDE

## Overview

This integration brings gstack's AI workflow patterns and browser automation capabilities to VOID IDE's Google Cloud infrastructure, enhancing Colab session management, Drive synchronization, and cloud resource provisioning.

## What gstack Provides

gstack is an AI engineering workflow system that provides:
- **Structured workflow skills** - specialized AI roles (CEO, QA, security, design)
- **Fast headless browser** - persistent Chromium daemon via Playwright
- **Security architecture** - SSRF protection, injection defense, token auth
- **Skill template system** - auto-generated documentation from source

## What VOID IDE Provides

VOID IDE includes comprehensive Google Cloud integration:
- **Google OAuth2** (`googleAuth.ts`) - OAuth2 authentication flow
- **Google Drive Sync** (`googleDriveSync.ts`) - File synchronization with structured folders
- **Colab Session Manager** (`colabSessionManager.ts`) - Full lifecycle management of Colab notebooks
- **Colab Kernel Bridge** (`colabKernelBridge.ts`) - Direct kernel execution via Colab APIs
- **Gateway Manager** (`gatewayManager.ts`) - Multi-backend execution abstraction

## New Components Added

### 1. AI Colab Orchestrator (`aiColabOrchestrator.ts`)

Extends Colab management with intelligent features:

```typescript
import { aiOrchestrator } from './src/services/aiColabOrchestrator';

// Get AI recommendations for current session
const recommendations = await aiOrchestrator.analyzeSession(userId);
// Returns: [{ type: 'extend'|'shutdown'|'gpu_upgrade', reason, action, confidence }]

// Predict optimal session duration
const duration = aiOrchestrator.predictOptimalSessionDuration(sessionId);

// Estimate session cost
const cost = await aiOrchestrator.estimateSessionCost(sessionId);

// Get gateway recommendation
const gateway = await aiOrchestrator.recommendGateway({
  needsGPU: true,
  needsDocker: false,
  estimatedRuntime: 7200,
  memoryNeeded: 8192,
  language: 'python'
});
```

**Features:**
- Intelligent session lifecycle management
- Predictive auto-shutdown warnings based on usage patterns
- GPU utilization monitoring & optimization suggestions
- Auto-backup scheduling based on activity
- Cost estimation for Colab Pro usage

### 2. AI-Enhanced Drive Sync (`aiDriveSync.ts`)

Smart file synchronization with AI categorization:

```typescript
import { aiDriveSync } from './src/services/aiDriveSync';

// Categorize files
const files = await aiDriveSync.categorizeFiles([
  { path: 'src/main.ts', content: '...', language: 'typescript' }
]);

// Smart sync decisions
const decision = await aiDriveSync.decideSyncAction(localFile, remoteFile);

// Predictive backup schedule
const schedule = aiDriveSync.predictBackupSchedule(sessionId);
```

**Features:**
- Automatic file categorization (code, notebook, data, model, docs)
- Importance scoring for backup prioritization
- Intelligent conflict resolution
- Duplicate file detection
- Sync statistics & insights

### 3. Skill Registry (`skillRegistry.ts`)

gstack-style slash command system for VOID:

```typescript
import { skillRegistry } from './src/services/skillRegistry';

// Execute a skill directly
const result = await skillRegistry.execute('colab-start', ['my-project', '--gpu'], context);

// List all available skills
const skills = skillRegistry.listSkills();
```

**Available Skills:**

| Skill | Description |
|-------|-------------|
| `/colab-start [name] [--gpu] [--hours=N]` | Start Colab session with intelligent config |
| `/colab-status` | Show session status with AI metrics |
| `/colab-extend [hours]` | Extend session runtime |
| `/colab-backup` | Backup current session to Drive |
| `/colab-stop` | Gracefully shutdown session |
| `/drive-mount [workspace]` | Mount Drive with smart paths |
| `/drive-sync [direction]` | Sync files with AI conflict resolution |
| `/drive-list [folder]` | List Drive contents |
| `/resource-check` | Check resource availability |
| `/gpu-status` | Detailed GPU metrics |
| `/gpu-recommend` | AI recommendation on GPU usage |
| `/auto-session` | One-command full setup |
| `/project-init [name]` | Initialize new project in Drive |

### 4. CLI Tools

#### void-skill
```bash
# Start a new Colab session with GPU
bun run bin/void-skill.ts colab-start my-project --gpu --hours=12

# Check status
bun run bin/void-skill.ts colab-status

# Get AI recommendations
bun run bin/void-skill.ts gpu-recommend

# Initialize project
bun run bin/void-skill.ts project-init my-ai-project
```

Add to package.json:
```json
{
  "scripts": {
    "skill": "bun run bin/void-skill.ts",
    "auth": "bun run bin/void-auth.ts"
  }
}
```

#### void-auth
```bash
# Login to Google
npm run auth -- login

# Check status
npm run auth -- status

# Logout
npm run auth -- logout
```

### 5. Enhanced Gateway Manager

The `ColabGateway` now integrates with the real `ColabSessionManager`:

```typescript
import { gatewayManager } from './src/services/gatewayManager';

// Active gateway set to colab by default
await gatewayManager.setActiveGateway('colab');

// Execute code
const result = await gatewayManager.execute({
  code: 'print("Hello from Colab!")',
  language: 'python'
});
```

## API Endpoints Added

### AI Colab Orchestration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/colab/recommend` | POST | Get AI recommendations for session |
| `/api/ai/colab/predict-duration` | GET | Predict optimal runtime |
| `/api/ai/colab/estimate-cost` | GET | Estimate Colab cost |
| `/api/ai/drive/auto-mount` | POST | Smart Drive mounting |
| `/api/ai/gateway/recommend` | POST | Gateway selection AI |

### Skill System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/skills/execute` | POST | Execute a skill |
| `/api/skills/list` | GET | List available skills |

### Enhanced Drive

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drive/ai/analyze` | POST | AI file categorization |
| `/api/drive/ai/stats` | GET | Sync statistics with insights |

## Installation

1. **Clone gstack into VOID IDE**

```bash
cd /workspaces/voidspace
git clone https://github.com/garrytan/gstack.git infused-gstack
```

2. **Install dependencies**

```bash
bun install
```

3. **Set up Google Cloud credentials**

```bash
# Copy environment template
cp .env.example .env

# Add your Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
```

4. **Authenticate with Google**

```bash
npm run auth -- login
```

5. **Start development server**

```bash
npm run dev
```

## Usage Examples

### Quick Start: AI-Powered Colab Session

```bash
# 1. Initialize project in Drive
npm run skill -- project-init my-ml-project

# 2. Mount Drive automatically
npm run skill -- drive-mount my-ml-project

# 3. Start Colab with AI-recommended settings
npm run skill -- colab-start my-ml-project --gpu --hours=12

# 4. Check AI recommendations
npm run skill -- colab-status

# 5. Get AI suggestions throughout session
npm run skill -- gpu-recommend
npm run skill -- resource-check
```

### Via REST API

```bash
# Get AI recommendations
curl -X POST http://localhost:3000/api/ai/colab/recommend \
  -H "Authorization: Bearer $TOKEN"

# Execute skill programmatically
curl -X POST http://localhost:3000/api/skills/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "colab-start",
    "args": ["my-project", "--gpu"]
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VOID IDE Frontend                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐              │
│  │   Skill CLI     │◄──►│  Skill Registry  │              │
│  │ (void-skill)    │    │  /skill endpoint │              │
│  └─────────────────┘    └──────────────────┘              │
│         │                          │                       │
│         ▼                          ▼                       │
│  ┌─────────────────────────────────────────────┐          │
│  │        AI Orchestrator                      │          │
│  │  • Colab session AI manager                 │          │
│  │  • Drive sync optimizer                     │          │
│  │  • Gateway recommender                      │          │
│  └─────────────────────────────────────────────┘          │
│         │                          │                       │
│         ▼                          ▼                       │
│  ┌──────────────┐    ┌───────────────────────┐          │
│  │ColabGateway  │    │GoogleDriveSyncManager │          │
│  │(real Colab)  │    │+ AI enhancements       │          │
│  └──────────────┘    └───────────────────────┘          │
│         │                          │                       │
│         └──────────┬───────────────┘                       │
│                    ▼                                       │
│         ┌──────────────────────┐                           │
│         │ Colab Session Mgr    │                           │
│         │ (kernel, metrics,    │                           │
│         │  auto-backup, etc)   │                           │
│         └──────────────────────┘                           │
│                    │                                        │
│                    ▼                                        │
│         ┌──────────────────────┐                           │
│         │ Google Cloud APIs    │                           │
│         │ • Colab              │                           │
│         │ • Drive              │                           │
│         │ • OAuth2              │                           │
│         └──────────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## gstack Features Borrowed

### 1. Skill-Driven Architecture

gstack's slash-command pattern (`/office-hours`, `/review`, `/qa`) is adapted for cloud resource management. Each skill is:
- Self-contained with clear input/output
- Composable (skills can call other skills)
- Context-aware (knows about current session, user, workspace)

### 2. AI-Powered Automation

From gstack's AI orchestration:
- Predictive session management
- Intelligent resource allocation
- Cost-aware recommendations
- Self-healing session recovery

### 3. Security Architecture

Adapted from gstack's security model:
- Token-based authentication for all API calls
- SSRF protection (blocks cloud metadata endpoints)
- Session isolation
- Credential encryption at rest

### 4. Fast External Service Integration

gstack's browser daemon pattern inspired:
- Persistent Colab kernel connection (no re-auth per cell)
- Sub-second API response via connection pooling
- Automatic lifecycle management

## Testing

```bash
# Type check
npm run lint

# Run unit tests
bun test

# Test skill execution
npm run skill -- colab-status

# Test AI recommendations
curl -X POST http://localhost:3000/api/ai/colab/recommend \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Next Steps

1. **Full ColabGateway Implementation**
   - Currently delegates to ColabSessionManager
   - Could support parallel sessions
   - Add queue-based execution for multiple gateways

2. **AI Drive Sync Realization**
   - Implement actual file hashing & dedup
   - Add ML-based file categorization
   - WebHooks for real-time Drive changes

3. **Skill Expansion**
   - `/security-scan` - OWASP check on project
   - `/cost-optimize` - Find idle resources
   - `/backup-verify` - Ensure backups are healthy

4. **gstack Browser Integration**
   - Use gstack's Playwright daemon for Drive UI automation
   - Automated Google Cloud Console navigation
   - Visual QA of deployed resources

5. **Multi-AI Provider Support**
   - Integrate Gemini for recommendations
   - Claude Code agent for complex workflows
   - OpenAI Codex for code review of cloud configs

## Summary

This integration combines:
- **VOID IDE's** robust Google Cloud infrastructure (OAuth, Drive, Colab)
- **gstack's** AI workflow patterns and security architecture

Result: An intelligent, self-managing cloud development environment that automates resource provisioning, optimizes costs, and provides AI-powered assistance throughout the development lifecycle.
