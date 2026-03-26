# TODO — Known Bugs & Logic Errors

Identified via code audit on 2026-03-26. Grouped by severity. No fixes applied — document only.

---

## CRITICAL — Game-Breaking

### BUG-001: Bot uses triple-click simulation with stale closures
**File:** `apps/web/src/hooks/useBotGame.ts:51–68`

The bot makes its move by simulating three `onSquareClick` calls:
1. `game.onSquareClick(from)` — immediately, at line 51
2. `game.onSquareClick(from)` — again inside `setTimeout(..., 40)` at line 60
3. `game.onSquareClick(to)` — inside a nested `setTimeout(..., 80)` at line 65

`onSquareClick` is a `useCallback` that captures `state` from render. The outer click (line 51) fires with the state at the time the effect runs. The inner clicks fire 40–80ms later and depend on React having re-rendered in that window. Because `useLocalGame.onSquareClick` re-selects a piece if it is already selected, the double-FROM click works most of the time — but fails if React batches renders or a chaos event fires between clicks. The correct fix is to expose `applyMove` directly from `useLocalGame` instead of simulating UI clicks.

---

### BUG-002: Online lobby player name is never sent to the socket
**File:** `apps/web/src/app/online/page.tsx:32,162` + `apps/web/src/hooks/useOnlineGame.ts:228`

`useOnlineGame()` is called on line 162 with no arguments, so `playerName` defaults to `'Player'`. The lobby form collects a name in its own local state (`playerName` at line 32 of the page), but `game.createRoom()` and `game.joinRoom()` both use the hook's internal `'Player'` string. There is no mechanism to pass the form value to the hook after mount. Both players are always named "Player" in every online game.

---

### BUG-003: Board never flips for black player in online mode
**File:** `apps/web/src/components/Board.tsx:84–85`

`RANKS` is always rendered `['8','7','6','5','4','3','2','1']` — white's perspective. The `humanColor` prop is received by `Board` but is only used for the `botLabel` display string. There is no code that reverses the rank/file iteration when `humanColor === 'b'`. A black player in online mode sees their own pieces at the top of the board and must play "upside down."

---

## HIGH — Significant Logic Errors

### BUG-004: Boredom timer runs during bot's turn; fires phantom moves mid-think
**File:** `apps/web/src/hooks/useBotGame.ts:101` + `apps/web/src/hooks/useLocalGame.ts:143–149`

`useBotGame` suppresses the timer *display* when it is the bot's turn (`timerSeconds: game.turn === humanColor ? game.timerSeconds : 15` at line 101), but the actual `setInterval` in `useLocalGame` keeps running. If the 15-second countdown reaches zero while the bot is computing (worst case: Eagle + Stockfish at 1.5 s think time), `doBoredomShuffle` fires for the bot's color. The bot then also completes its own regular move, resulting in two moves in a single turn for the bot.

---

### BUG-005: `botThinkingRef` not reset on game reset; bot can freeze on the new game
**File:** `apps/web/src/hooks/useBotGame.ts:13,87–89`

`botThinkingRef.current = true` is set when the bot starts computing. If `onReset()` is called while `think()` is awaiting Stockfish, the new game's `useEffect` fires (because `game.fen` changed), but `botThinkingRef.current` is still `true` from the old think cycle, so the effect exits early at line 21. The first bot move of the new game is never triggered until the in-flight old `think()` finishes. When the old `think()` does finish, it calls `game.onSquareClick` with a move from the old board position against the new fresh board, potentially corrupting the new game.

---

### BUG-006: Capture particle animations are dead code — `triggerCapture` is never called
**File:** `apps/web/src/components/Board.tsx:47–53`

`triggerCapture(sq)` is defined inside `Board` and calls `spawnParticles(el)`, which injects DOM particles and a CSS flash class. Neither function is ever called — not via props, not via a ref, not from any event handler. The intended capture visual effect (particle burst on the destination square) is fully implemented but completely non-functional. `spawnParticles` is dead code as a consequence.

---

### BUG-007: Boredom shuffle can fire while the promotion modal is open
**File:** `apps/web/src/hooks/useLocalGame.ts:143–149`

The boredom effect at line 143 checks `!state.isOver` but not `!!state.pendingPromotion`. When a pawn reaches rank 8, the promotion modal opens and `state.pendingPromotion` is set, but the timer keeps running. If the user takes longer than the remaining timer seconds to pick a piece, `doBoredomShuffle` fires. Because the pawn move has not yet been committed to `engine` (the engine still reflects the pre-promotion state), the shuffle can phantom-move the promoting pawn — or other pieces of the promoting player — to random squares before the promotion choice is registered.

---

### BUG-008: Race condition between `room-joined` and `game-start` can give joiner wrong color
**File:** `apps/web/src/hooks/useOnlineGame.ts:162–174`

When player B joins a room, the server emits `room-joined` (to B only) and then immediately emits `game-start` (to the full room). Both events arrive in the same Socket.io message batch. The `room-joined` handler dispatches `GAME_START` with `playerColor: 'b'`. The `game-start` handler dispatches `GAME_START` with `playerColor: state.playerColor ?? 'w'`. Because React state is not synchronously committed between two socket event handlers in the same tick, `state.playerColor` may still be `null` when `game-start` fires, so the fallback `'w'` is used. The joiner ends up thinking they are white instead of black.

---

## MEDIUM — Incorrect Behavior

### BUG-009: Timer stays stuck at 0 if the last boredom piece's phantom move fails
**File:** `apps/web/src/hooks/useLocalGame.ts:230–251`

`startTimer()` is called at the end of the last boredom `setTimeout` callback (line 250), but only if `applyPhantomMove` succeeds (the `if (!result) return` on line 242 exits early). If the last chosen piece cannot complete its phantom move, `startTimer()` is never called. The timer bar stays frozen at 0, the interval is dead, and the boredom log message shows without a subsequent timer restart. The timer does resume after the human makes their next normal move (which calls `startTimer()` at `useLocalGame.ts:279`), so it is not permanent — but the frozen-at-0 state is confusing UX.

---

### BUG-010: Online `onReset` leaves the socket subscribed to the old room
**File:** `apps/web/src/hooks/useOnlineGame.ts:293–296` + `apps/web/src/app/online/page.tsx:241`

`onReset()` dispatches `{ type: 'RESET' }` to return to the lobby, but does not disconnect the socket or emit a leave/resign event. The socket remains connected and the client continues to receive `move-made`, `chaos-applied`, and `game-over` events from the old room. If the opponent is still active and makes moves, those events are dispatched against the now-reset `engineRef.current`, potentially loading an entirely different FEN position into any subsequent new game session created in the same component lifecycle.

---

### BUG-011: Stockfish fetched from hardcoded CDN URL; fails offline and uses a 7-year-old engine
**File:** `apps/web/src/hooks/useStockfish.ts:26–29`

Stockfish 10 (2018) is fetched from `cdnjs.cloudflare.com` at runtime. There is no local copy, no configurable URL, and no retry logic. Eagle level silently falls back to Fox if the CDN is unreachable (offline, corporate network proxy, CDN downtime). The Eagle difficulty description promises "Stockfish WASM, depth 15" — but Stockfish 10 is several generations of NNUE improvements behind the current engine.

---

### BUG-012: Second boredom piece targets a square that may have moved in the first shuffle
**File:** `apps/web/src/hooks/useLocalGame.ts:228–252`

When `count === 2`, the `chosen` array (two pieces to shuffle) is assembled before either `setTimeout` fires. Piece A shuffles at `t=0ms`, piece B at `t=700ms`. Piece B's source square `sq` is captured from the pre-shuffle board. If piece A moved *to* piece B's square (or piece A was at piece B's square), the `applyPhantomMove` for piece B either silently fails (returns null) or moves the wrong occupant. The null check on line 241 handles the failure case gracefully, but the intended "two pieces revolt" effect becomes a "one piece revolts" effect with no error signal.

---

### BUG-013: `engineRef` and `state.fen` have a window of inconsistency during async dispatch
**File:** `apps/web/src/hooks/useLocalGame.ts:123,346`

`engineRef.current` is mutated directly (`engine.move()`, `applyPhantomMove(engine, ...)`, `engine.load()`), and `state.fen` is updated via `dispatch` separately. Between mutation and the state commit completing, `engineRef.current.fen !== state.fen`. The `doBoredomShuffle` timeouts (multiple `setTimeout` callbacks at `t=0ms`, `t=700ms`) read from and write to `engineRef.current` between dispatch calls. If a drift timeout also fires in this window (the drift is scheduled 550ms after a move), both can be operating on the same mutable `ChessEngine` object concurrently, producing a mixed board position where neither the drift event nor the boredom shuffle has a coherent view of the board.

---

## LOW — Polish / Stale State

### BUG-014: README references Next.js 14; project runs Next.js 16
**File:** `README.md:15,19`

The architecture diagram says "Next.js 14 App Router frontend" and the tech stack lists "Next.js 14". The actual installed and running version is Next.js 16.

---

### BUG-015: `Sidebar.tsx` — `now` variable defined but never used
**File:** `apps/web/src/components/Sidebar.tsx:51`

`const now = new Date()` is created on every render but never referenced. Dead code / lint warning.

---

### BUG-016: `derivedEngine` instantiated on every render instead of being memoized
**File:** `apps/web/src/hooks/useLocalGame.ts:346` + `apps/web/src/hooks/useOnlineGame.ts:298`

Both hooks call `new ChessEngine(state.fen)` unconditionally on every render. This allocates and parses a full chess position object on every re-render, including timer ticks (every 1 second). Should be wrapped in `useMemo` keyed on `state.fen`.
