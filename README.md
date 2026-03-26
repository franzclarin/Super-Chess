# 🐾 Super Chess — Chaos Edition

Chess, but the pieces have opinions. A full-stack multiplayer chess app with three modes, synthesized sound effects, autonomous chaos mechanics, and a bot that trash-talks.

---

## Architecture

```
super-chess/
├── index.html                  ← Original single-file build (still works standalone)
├── packages/
│   └── chess-core/             ← Shared chess logic (chess.js wrapper, bot AI, phantom moves)
└── apps/
    ├── web/                    ← Next.js 14 App Router frontend (deploy → Vercel)
    └── server/                 ← Express + Socket.io backend (deploy → Railway/Render)
```

**Tech stack:** Next.js 14 · TypeScript · chess.js 1.x · Socket.io 4 · Web Audio API · Stockfish WASM · Turborepo

---

## Modes

| Mode | Description |
|------|-------------|
| 🐾 **Local Play** | Two players, one screen. Full chaos. Boredom timer, drift events, trash talk. |
| 🌐 **Online Play** | Room codes (`WOLF-42` style). Server-authoritative moves and chaos. Rematch support. |
| 🤖 **Bot Play** | Four difficulties: Kitten (random), Puppy (material), Fox (minimax depth-3), Eagle (Stockfish 15/20). |

---

## Local Dev Setup

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10 (workspaces support required)

### Install & Run

```bash
# From the repo root
npm install

# Start everything (web + server)
npm run dev

# Or start individually
npm run dev:web     # → http://localhost:3000
npm run dev:server  # → http://localhost:3001
```

### First-time .env setup

```bash
# apps/web
cp apps/web/.env.example apps/web/.env.local
# Edit NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# apps/server
cp apps/server/.env.example apps/server/.env
# Edit CORS_ORIGIN=http://localhost:3000
```

### Build

```bash
npm run build          # builds all packages
npm run type-check     # TypeScript check across monorepo
```

---

## Deployment

### Frontend → Vercel

1. Import the repo into Vercel. Set **Root Directory** to `apps/web`.
2. Add environment variable:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://your-server.railway.app
   ```
3. Deploy. Vercel auto-detects Next.js.

> **Note:** Set Framework Preset to **Next.js** and ensure Turborepo is not configured as a custom build command — Vercel handles Next.js builds natively.

### Backend → Railway

1. Create a new Railway project → **Deploy from GitHub**.
2. In settings, set **Root Directory** to `/` (monorepo root) so the Dockerfile at root is used.
3. Set environment variables:
   ```
   PORT=3001
   CORS_ORIGIN=https://your-app.vercel.app
   NODE_ENV=production
   ```
4. Railway will build using the `Dockerfile` at the repo root.
5. Enable **Sticky Sessions** in Railway networking settings (required for Socket.io polling fallback).
6. Copy the generated Railway URL → paste into Vercel's `NEXT_PUBLIC_SOCKET_URL`.

### Backend → Render

1. New Web Service → connect repo.
2. Build Command: `npm install && npm run build --workspace=packages/chess-core && npm run build --workspace=server`
3. Start Command: `node apps/server/dist/index.js`
4. Set the same environment variables as Railway.
5. Enable **Session Affinity** in Render settings.

### Health check

The server exposes `GET /health` → `{ "status": "ok", "uptime": N }`. Configure your Railway/Render health check to hit this endpoint.

---

## How Room Codes Work

1. Player A clicks **Create Game** → server generates a code like `WOLF-42`.
2. Player A shares the code (copy-to-clipboard button in UI).
3. Player B enters the code in **Join Game** → server validates and starts the game.
4. Codes expire after **10 minutes of inactivity**.
5. If a player disconnects, the opponent sees a warning. The disconnected player has **30 seconds** to reconnect before the room is forfeited.
6. After a game ends, either player can **Offer Rematch**. Both must accept; colors swap.

---

## Chaos Features

### Boredom Timer
Each player has 15 seconds to move. The timer bar shifts green → orange → red. If it hits zero, 1–2 random pieces shuffle to legal squares. The timer resets — the player still makes their own move. Server handles this in online mode; client handles it in local/bot mode.

### Autonomous Drift
After every completed move there's a **20% chance** a random piece from either side spontaneously drifts to a legal square. Drift moves don't change whose turn it is (implemented via FEN turn-swap trick). A message appears in the Chaos Log.

### Phantom Moves
Both boredom shuffles and drift are *phantom moves* — the FEN is temporarily modified to allow a piece to move out of turn, then the turn is restored. Core primitive in `packages/chess-core/src/index.ts → applyPhantomMove()`.

---

## Bot Levels

| Level | Strategy | Speed |
|-------|----------|-------|
| 🐱 **Kitten** | Random legal moves. 15% chance ignores check. | Instant |
| 🐶 **Puppy** | Prefers highest-value captures. Otherwise random. | Instant |
| 🦊 **Fox** | Negamax depth-3 with alpha-beta pruning + piece-square tables. | ~50–200ms |
| 🦅 **Eagle** | Stockfish WASM (fetched from CDN, runs in Web Worker). Skill Level 15/20. | ~1.5s |

The Eagle bot loads Stockfish lazily. While loading it falls back to Fox.

---

## Deployment Checklist

- [ ] `NEXT_PUBLIC_SOCKET_URL` set in Vercel
- [ ] `CORS_ORIGIN` set on backend to match Vercel domain exactly
- [ ] Sticky sessions / session affinity enabled on backend host
- [ ] `/health` endpoint returning 200
- [ ] Room codes tested end-to-end between two browser tabs
- [ ] Stockfish Eagle bot tested (requires HTTPS for Web Workers in production)

---

## Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web + server in watch mode |
| `npm run dev:web` | Web only |
| `npm run dev:server` | Server only |
| `npm run build` | Full production build |
| `npm run type-check` | TypeScript check (no emit) |
| `npm run lint` | ESLint across all packages |

---

## Legacy Build

The original single-file `index.html` at the repo root still works — open it directly in any browser. No build step required.