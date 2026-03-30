import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  createRoom, joinRoom, getRoom, applyMove, applyChaosEvent,
  applyBoredomShuffle, startRematch, markDisconnected, markReconnected,
  getRoomBySocketId, resetBoredomTimer, clearBoredomTimer,
} from './rooms';
import type { Color } from '@super-chess/chess-core';

const app = express();
const httpServer = createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', uptime: process.uptime() }));

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

// Per-socket rate limit: max 1 move per 500ms
const moveCooldowns = new Map<string, number>();

// Helper: start/reset the server-side boredom timer for a room and broadcast results
function startBoredom(roomId: string) {
  resetBoredomTimer(roomId, (results) => {
    for (const chaos of results) {
      io.to(roomId).emit('chaos-applied', chaos);
    }
  });
}

io.on('connection', (socket) => {
  // ── Create Room ────────────────────────────────────────────────────────
  socket.on('create-room', ({ playerName }: { playerName: string }) => {
    const room = createRoom(socket.id, playerName ?? 'Player 1');
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.color = 'w' as Color;
    socket.emit('room-created', { roomId: room.id, color: 'w' });
  });

  // ── Join Room ──────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const result = joinRoom(roomId, socket.id, playerName ?? 'Player 2');
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }
    const { room } = result;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = 'b' as Color;

    // Notify joiner of their color
    socket.emit('room-joined', {
      color: 'b',
      opponentName: room.players.w?.name ?? 'Opponent',
    });
    // Notify creator that opponent joined
    socket.to(roomId).emit('opponent-joined', {
      opponentName: playerName ?? 'Player 2',
      color: 'b',
    });
    // Start game for both
    io.to(roomId).emit('game-start', {
      fen: room.fen,
      white: room.players.w?.name ?? 'White',
      black: room.players.b?.name ?? 'Black',
    });
    // Start server-side boredom timer
    startBoredom(roomId);
  });

  // ── Move ───────────────────────────────────────────────────────────────
  socket.on('move', ({ roomId, from, to, promotion }: {
    roomId: string; from: string; to: string; promotion?: string;
  }) => {
    // Rate limiting
    const now = Date.now();
    const last = moveCooldowns.get(socket.id) ?? 0;
    if (now - last < 500) return;
    moveCooldowns.set(socket.id, now);

    const result = applyMove(roomId, socket.id, from, to, promotion);
    if (!result.ok) {
      socket.emit('move-rejected', { message: result.error });
      return;
    }

    io.to(roomId).emit('move-made', { from, to, promotion, fen: result.fen, san: result.san });

    // Check game over
    const room = getRoom(roomId);
    if (room?.engine.isGameOver) {
      clearBoredomTimer(roomId);
      const engine = room.engine;
      let winner: Color | null = null;
      let reason: 'checkmate' | 'stalemate' | 'draw' = 'draw';
      if (engine.isCheckmate) {
        reason = 'checkmate';
        winner = engine.turn === 'w' ? 'b' : 'w';
      } else if (engine.isStalemate) {
        reason = 'stalemate';
      }
      io.to(roomId).emit('game-over', { reason, winner });
      return;
    }

    // 20% drift after every move (server-authoritative)
    if (Math.random() < 0.20) {
      setTimeout(() => {
        const chaos = applyChaosEvent(roomId);
        if (chaos) io.to(roomId).emit('chaos-applied', chaos);
      }, 600);
    }

    // Reset server-side boredom timer after each move
    startBoredom(roomId);
  });

  // ── Boredom (client signal kept for backwards compat, no-op now) ───────
  socket.on('chaos-request', () => { /* server-side timer handles boredom now */ });

  // ── Chat ───────────────────────────────────────────────────────────────
  socket.on('chat-message', ({ roomId, player, text }: {
    roomId: string; player: Color; text: string;
  }) => {
    io.to(roomId).emit('chat-received', { player, text, timestamp: Date.now() });
  });

  // ── Resign ─────────────────────────────────────────────────────────────
  socket.on('resign', ({ roomId }: { roomId: string }) => {
    const color = socket.data.color as Color;
    clearBoredomTimer(roomId);
    const room = getRoom(roomId);
    if (room) room.status = 'finished';
    io.to(roomId).emit('game-over', {
      reason: 'resign',
      winner: color === 'w' ? 'b' : 'w',
    });
  });

  // ── Rematch ────────────────────────────────────────────────────────────
  socket.on('rematch-offer', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('rematch-offered');
  });

  socket.on('rematch-accept', ({ roomId }: { roomId: string }) => {
    const color = socket.data.color as Color;
    const ready = startRematch(roomId, color);
    if (ready) {
      const room = getRoom(roomId);
      if (room) {
        // C-2: tell each socket its new (swapped) color before game-start fires
        const wSock = io.sockets.sockets.get(room.players.w?.socketId ?? '');
        const bSock = io.sockets.sockets.get(room.players.b?.socketId ?? '');
        if (wSock) { wSock.data.color = 'w'; wSock.emit('color-assigned', { color: 'w' }); }
        if (bSock) { bSock.data.color = 'b'; bSock.emit('color-assigned', { color: 'b' }); }

        io.to(roomId).emit('rematch-accepted', { fen: room.fen });
        io.to(roomId).emit('game-start', {
          fen: room.fen,
          white: room.players.w?.name ?? 'White',
          black: room.players.b?.name ?? 'Black',
        });
        startBoredom(roomId);
      }
    }
  });

  // ── Reconnect ──────────────────────────────────────────────────────────
  socket.on('reconnect-game', ({ roomId }: { roomId: string }) => {
    const color = markReconnected(roomId, socket.id);
    if (!color) { socket.emit('error', { message: 'Room expired' }); return; }
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = color;
    socket.to(roomId).emit('opponent-reconnected');
    const room = getRoom(roomId);
    if (room) {
      socket.emit('game-start', {
        fen: room.fen,
        white: room.players.w?.name ?? 'White',
        black: room.players.b?.name ?? 'Black',
      });
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    moveCooldowns.delete(socket.id);
    const roomId = socket.data.roomId as string | undefined;
    if (roomId) {
      // m-2: only notify opponent if game is still active (not already resigned/over)
      const room = getRoom(roomId);
      if (room && room.status === 'active') {
        socket.to(roomId).emit('opponent-disconnected');
      }
    }
    markDisconnected(socket.id, (expiredRoomId, abandonedColor) => {
      clearBoredomTimer(expiredRoomId);
      io.to(expiredRoomId).emit('game-over', {
        reason: 'abandonment',
        winner: abandonedColor === 'w' ? 'b' : 'w',
      });
    });
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🐾 Super Chess server running on port ${PORT}`);
});
