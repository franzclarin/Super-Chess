import { ChessEngine, applyPhantomMove } from '@super-chess/chess-core';
import type { Color, Piece, Square, RoomState, PhantomResult } from '@super-chess/chess-core';

const ROOM_EXPIRY_MS = Number(process.env.ROOM_EXPIRY_MS ?? 600_000); // 10 min
const RECONNECT_WINDOW_MS = Number(process.env.RECONNECT_WINDOW_MS ?? 30_000);
const BOREDOM_MS = Number(process.env.BOREDOM_MS ?? 15_000);

interface ServerRoom extends RoomState {
  engine: ChessEngine;
  pendingRematch: Set<Color>;
  disconnectTimers: Map<Color, ReturnType<typeof setTimeout>>;
  boredomTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, ServerRoom>();

// Sweep expired rooms every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.lastActivityAt > ROOM_EXPIRY_MS) {
      if (room.boredomTimer) clearTimeout(room.boredomTimer);
      rooms.delete(id);
    }
  }
}, 300_000);

function generateRoomId(): string {
  const animals = ['WOLF','BEAR','HAWK','LYNX','CROW','BOAR','STAG','MINK'];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${animal}-${num}`;
}

export function createRoom(socketId: string, playerName: string): ServerRoom {
  let id = generateRoomId();
  while (rooms.has(id)) id = generateRoomId();

  const room: ServerRoom = {
    id,
    fen: new ChessEngine().fen,
    status: 'waiting',
    players: {
      w: { socketId, name: playerName, color: 'w', connected: true },
      b: null,
    },
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    engine: new ChessEngine(),
    pendingRematch: new Set(),
    disconnectTimers: new Map(),
    boredomTimer: null,
  };
  rooms.set(id, room);
  return room;
}

export function joinRoom(
  roomId: string,
  socketId: string,
  playerName: string
): { room: ServerRoom; color: Color } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'waiting') return { error: 'Game already in progress' };
  if (!room.players.w) return { error: 'No host in room' };

  room.players.b = { socketId, name: playerName, color: 'b', connected: true };
  room.status = 'active';
  room.lastActivityAt = Date.now();
  return { room, color: 'b' };
}

export function getRoom(roomId: string): ServerRoom | undefined {
  return rooms.get(roomId);
}

export function applyMove(
  roomId: string,
  socketId: string,
  from: Square,
  to: Square,
  promotion?: string
): { ok: true; fen: string; san: string } | { ok: false; error: string } {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') return { ok: false, error: 'Game not active' };

  // Verify the player owns this color
  const color = room.engine.turn;
  const player = room.players[color];
  if (!player || player.socketId !== socketId) {
    return { ok: false, error: 'Not your turn' };
  }

  const result = room.engine.move({ from, to, promotion });
  if (!result) return { ok: false, error: 'Illegal move' };

  room.fen = room.engine.fen;
  room.lastActivityAt = Date.now();

  if (room.engine.isGameOver) {
    room.status = 'finished';
  }

  return { ok: true, fen: room.fen, san: result.san };
}

export interface ChaosResult {
  type: 'drift' | 'boredom';
  from: Square;
  to: Square;
  piece: Piece;
  fen: string;
  message: string;
}

export function applyChaosEvent(roomId: string): ChaosResult | null {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') return null;

  const engine = room.engine;

  const candidates: Array<{ sq: Square; piece: Piece; moves: ReturnType<ChessEngine['legalMoves']> }> = [];

  for (const color of ['w', 'b'] as Color[]) {
    const parts = engine.fen.split(' ');
    parts[1] = color;
    parts[3] = '-';
    const temp = new ChessEngine();
    temp.load(parts.join(' '));

    for (const rank of '87654321') {
      for (const file of 'abcdefgh') {
        const sq = file + rank;
        const p = temp.get(sq);
        if (p && p.color === color) {
          const mvs = temp.legalMoves(sq);
          if (mvs.length) candidates.push({ sq, piece: p, moves: mvs });
        }
      }
    }
  }

  if (!candidates.length) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const mv = chosen.moves[Math.floor(Math.random() * chosen.moves.length)];
  const promo = mv.flags?.includes('p') ? 'q' : undefined;

  const result: PhantomResult | null = applyPhantomMove(
    engine,
    chosen.sq as Square,
    mv.to as Square,
    chosen.piece.color,
    promo
  );

  if (!result) return null;

  room.fen = engine.fen;
  room.lastActivityAt = Date.now();

  const pieceNames: Record<string, string> = {
    k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
  };
  const colorName = chosen.piece.color === 'w' ? 'White' : 'Black';
  const pieceName = `${colorName} ${pieceNames[chosen.piece.type]}`;
  const message = `✨ ${pieceName} had a mind of its own and drifted to ${mv.to}!`;

  return { type: 'drift', from: chosen.sq, to: mv.to, piece: chosen.piece, fen: room.fen, message };
}

export function applyBoredomShuffle(
  roomId: string,
  color: Color
): ChaosResult[] {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') return [];
  if (room.engine.turn !== color) return [];

  const engine = room.engine;
  const results: ChaosResult[] = [];

  const pieces: Array<{ sq: Square; piece: Piece }> = [];
  for (const rank of '87654321') {
    for (const file of 'abcdefgh') {
      const sq = file + rank;
      const p = engine.get(sq);
      if (p && p.color === color) {
        const mvs = engine.legalMoves(sq);
        if (mvs.length) pieces.push({ sq, piece: p });
      }
    }
  }

  if (!pieces.length) return [];

  const count = Math.min(1 + (Math.random() < 0.5 ? 1 : 0), pieces.length);
  const chosen = [...pieces].sort(() => Math.random() - 0.5).slice(0, count);

  for (const { sq, piece } of chosen) {
    const parts = engine.fen.split(' ');
    parts[1] = piece.color;
    parts[3] = '-';
    const temp = new ChessEngine();
    temp.load(parts.join(' '));
    const mvs = temp.legalMoves(sq);
    if (!mvs.length) continue;

    const mv = mvs[Math.floor(Math.random() * mvs.length)];
    const promo = mv.flags?.includes('p') ? 'q' : undefined;
    const result = applyPhantomMove(engine, sq as Square, mv.to as Square, piece.color, promo);
    if (!result) continue;

    room.fen = engine.fen;

    const pieceNames: Record<string, string> = {
      k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
    };
    const colorName = piece.color === 'w' ? 'White' : 'Black';
    const pieceName = `${colorName} ${pieceNames[piece.type]}`;
    results.push({
      type: 'boredom',
      from: sq,
      to: mv.to,
      piece,
      fen: room.fen,
      message: `😴 ${pieceName} got bored and wandered to ${mv.to}!`,
    });
  }

  room.lastActivityAt = Date.now();
  return results;
}

// ── Server-side boredom timer ────────────────────────────────────────────────

export function resetBoredomTimer(
  roomId: string,
  onExpire: (results: ChaosResult[]) => void
): void {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.boredomTimer) { clearTimeout(room.boredomTimer); room.boredomTimer = null; }
  if (room.status !== 'active') return;

  room.boredomTimer = setTimeout(() => {
    room.boredomTimer = null;
    if (room.status !== 'active') return;
    const results = applyBoredomShuffle(roomId, room.engine.turn);
    if (results.length > 0) onExpire(results);
    // Restart for the next boredom window (same player still hasn't moved)
    resetBoredomTimer(roomId, onExpire);
  }, BOREDOM_MS);
}

export function clearBoredomTimer(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room || !room.boredomTimer) return;
  clearTimeout(room.boredomTimer);
  room.boredomTimer = null;
}

// ── Rematch ──────────────────────────────────────────────────────────────────

export function startRematch(roomId: string, color: Color): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.pendingRematch.add(color);
  if (room.pendingRematch.size === 2) {
    // Reset game, swap colors
    const oldW = room.players.w;
    const oldB = room.players.b;
    room.players.w = oldB ? { ...oldB, color: 'w' } : null;
    room.players.b = oldW ? { ...oldW, color: 'b' } : null;
    room.engine = new ChessEngine();
    room.fen = room.engine.fen;
    room.status = 'active';
    room.pendingRematch.clear();
    room.lastActivityAt = Date.now();
    return true;
  }
  return false;
}

// ── Disconnect handling ──────────────────────────────────────────────────────

export function markDisconnected(
  socketId: string,
  onExpire: (roomId: string, color: Color) => void
): void {
  for (const [roomId, room] of rooms) {
    for (const color of ['w', 'b'] as Color[]) {
      const p = room.players[color];
      if (p && p.socketId === socketId) {
        p.connected = false;
        const timer = setTimeout(() => {
          // m-1: don't fire second game-over if game already ended (e.g. via resign)
          if (room.status === 'finished') return;
          room.status = 'finished';
          onExpire(roomId, color);
        }, RECONNECT_WINDOW_MS);
        room.disconnectTimers.set(color, timer);
      }
    }
  }
}

export function markReconnected(roomId: string, socketId: string): Color | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const color of ['w', 'b'] as Color[]) {
    const p = room.players[color];
    if (p && !p.connected) {
      p.socketId = socketId;
      p.connected = true;
      const timer = room.disconnectTimers.get(color);
      if (timer) { clearTimeout(timer); room.disconnectTimers.delete(color); }
      return color;
    }
  }
  return null;
}

export function getRoomBySocketId(socketId: string): { room: ServerRoom; color: Color } | null {
  for (const room of rooms.values()) {
    for (const color of ['w', 'b'] as Color[]) {
      if (room.players[color]?.socketId === socketId) return { room, color };
    }
  }
  return null;
}
