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
    ├── web/                    ← Next.js 16 App Router frontend (deploy → Vercel)
    └── server/                 ← Express + Socket.io backend (deploy → Railway/Render)
```

**Tech stack:** Next.js 16 · TypeScript · chess.js 1.x · Socket.io 4 · Web Audio API · Stockfish WASM · Turborepo

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

---

## Known Logic Bugs

Full details and file references are in [`TODO.md`](./TODO.md). Summary:

### Critical — Game-Breaking

| # | Bug | Location |
|---|-----|----------|
| 001 | **Bot moves via triple-click simulation with stale React closures.** The bot calls `onSquareClick(from)` once before a `setTimeout`, then again 40 ms later, then `onSquareClick(to)` 80 ms after that. Works accidentally most of the time but can fail when React batches renders or chaos events fire between clicks. `applyMove` should be exposed directly instead. | `useBotGame.ts:51–68` |
| 002 | **Online player name from the lobby form is never sent.** `useOnlineGame()` is called with no `playerName` argument (defaults to `'Player'`). The name typed in the lobby UI is held in local component state with no path to the hook. Both players are always named "Player." | `online/page.tsx:32,162` · `useOnlineGame.ts:228` |
| 003 | **Board never flips for the black player in online mode.** Ranks always render 8→1 (white's perspective). The `humanColor` prop is received but only used for a label, not for reversing the board orientation. A black player plays upside-down. | `Board.tsx:84–85` |

### High — Significant Logic Errors

| # | Bug | Location |
|---|-----|----------|
| 004 | **Boredom timer fires phantom moves while the bot is thinking.** Timer display is suppressed for the bot's turn but the interval keeps running. If the countdown reaches 0 during Stockfish's think time, `doBoredomShuffle` fires for the bot's color, and the bot then also makes its own regular move — two moves in one turn. | `useBotGame.ts:101` · `useLocalGame.ts:143–149` |
| 005 | **`botThinkingRef` not reset on game reset; first bot move of the new game may be skipped or corrupt the board.** If reset is called while `think()` awaits Stockfish, the new game's effect exits early (`botThinkingRef.current === true`). When the stale `think()` finishes, it applies an old-position move to the fresh board. | `useBotGame.ts:13,87–89` |
| 006 | **Capture particle animations are dead code.** `triggerCapture()` and `spawnParticles()` are fully implemented inside `Board` but are never called from any code path. Capture visual effects do not play. | `Board.tsx:47–53` |
| 007 | **Boredom shuffle fires while the promotion modal is open.** The boredom effect checks `!state.isOver` but not `!!state.pendingPromotion`. If the user spends more than the remaining timer seconds choosing a promotion piece, phantom moves are applied to the pre-promotion board state, potentially moving the promoting pawn away before the promotion is registered. | `useLocalGame.ts:143–149` |
| 008 | **`room-joined` / `game-start` race condition can assign the wrong color to the joiner.** Both events arrive in the same Socket.io batch. If `game-start` is processed before `state.playerColor` is committed from `room-joined`, the fallback `'w'` is used and the joiner sees themselves as white. | `useOnlineGame.ts:162–174` |

### Medium — Incorrect Behavior

| # | Bug | Location |
|---|-----|----------|
| 009 | **Timer stays frozen at 0 if the last boredom piece's phantom move fails.** `startTimer()` is inside a conditional that exits early on `applyPhantomMove` returning null; the timer is not restarted until the human makes their next move. | `useLocalGame.ts:230–251` |
| 010 | **Online `onReset` leaves the socket subscribed to the old room.** State resets to the lobby but the socket stays connected. Subsequent `move-made` / `chaos-applied` events from the abandoned room are dispatched against the new session's engine. | `useOnlineGame.ts:293–296` |
| 011 | **Stockfish hardcoded to a CDN URL; fails offline; uses Stockfish 10 (2018).** No local copy, no retry, no configurable URL. Eagle silently degrades to Fox when the CDN is unreachable. | `useStockfish.ts:26–29` |
| 012 | **Second boredom piece may target a square vacated or occupied by the first boredom piece.** The `chosen` array is snapshotted before either `setTimeout` fires; piece B's source square can be stale by the time its callback runs at t=700 ms. | `useLocalGame.ts:228–252` |
| 013 | **`engineRef` and `state.fen` have a brief inconsistency window.** `engineRef.current` is mutated directly before `dispatch` commits `state.fen`. Concurrent boredom shuffle and drift timeouts both read/write the same mutable `ChessEngine` object between dispatch calls, which can produce mixed board positions. | `useLocalGame.ts:123,346` |

### Low — Polish / Stale State

| # | Bug | Location |
|---|-----|----------|
| 014 | README referenced Next.js 14; updated to 16. | `README.md` (fixed) |
| 015 | `const now = new Date()` in `Sidebar.tsx` is defined but never used. | `Sidebar.tsx:51` |
| 016 | `new ChessEngine(state.fen)` runs on every render (including every timer tick) instead of being memoized with `useMemo`. | `useLocalGame.ts:346` · `useOnlineGame.ts:298` |