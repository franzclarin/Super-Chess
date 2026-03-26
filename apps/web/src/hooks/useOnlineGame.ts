'use client';
import { useReducer, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChessEngine, applyPhantomMove } from '@super-chess/chess-core';
import type { Color, Piece, Square, ChatMessage } from '@super-chess/chess-core';
import { playAnimal, playExplosion } from '@/lib/sounds';
import { PIECE_NAMES } from '@/lib/constants';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type LobbyStatus = 'idle' | 'creating' | 'waiting' | 'joining' | 'active';

export interface OnlineGameState {
  fen: string;
  selectedSquare: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  capturedByWhite: Piece[];
  capturedByBlack: Piece[];
  timerSeconds: number;
  events: string[];
  chatMessages: ChatMessage[];
  pendingPromotion: { from: Square; to: Square } | null;
  isOver: boolean;
  winner: Color | null;
  overReason: 'checkmate' | 'stalemate' | 'draw' | 'resign' | 'abandonment' | null;
  roomCode: string | null;
  playerColor: Color | null;
  playerName: string;
  opponentName: string;
  connectionStatus: ConnectionStatus;
  lobbyStatus: LobbyStatus;
  rematchOffered: boolean;
  opponentDisconnected: boolean;
}

type Action =
  | { type: 'SET_CONNECTION'; status: ConnectionStatus }
  | { type: 'SET_LOBBY'; status: LobbyStatus }
  | { type: 'ROOM_CREATED'; code: string; color: Color }
  | { type: 'GAME_START'; fen: string; white: string; black: string; playerColor: Color }
  | { type: 'SELECT'; sq: Square; targets: Square[] }
  | { type: 'DESELECT' }
  | { type: 'MOVE_APPLIED'; fen: string; from: Square; to: Square; mover: Color; captured?: Piece }
  | { type: 'PHANTOM_APPLIED'; fen: string; from: Square; to: Square; captured?: Piece }
  | { type: 'SET_PENDING_PROMO'; from: Square; to: Square }
  | { type: 'CANCEL_PROMO' }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_RESET' }
  | { type: 'ADD_EVENT'; msg: string }
  | { type: 'ADD_CHAT'; msg: ChatMessage }
  | { type: 'GAME_OVER'; winner: Color | null; reason: OnlineGameState['overReason'] }
  | { type: 'REMATCH_OFFERED' }
  | { type: 'REMATCH_ACCEPTED'; fen: string }
  | { type: 'OPPONENT_DISCONNECTED' }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'RESET' };

function reducer(state: OnlineGameState, action: Action): OnlineGameState {
  switch (action.type) {
    case 'SET_CONNECTION': return { ...state, connectionStatus: action.status };
    case 'SET_LOBBY': return { ...state, lobbyStatus: action.status };
    case 'ROOM_CREATED': return { ...state, roomCode: action.code, playerColor: action.color, lobbyStatus: 'waiting' };
    case 'GAME_START': {
      const playerColor = state.playerColor ?? action.playerColor;
      const opponentName = playerColor === 'w' ? action.black : action.white;
      return {
        ...state, fen: action.fen,
        opponentName,
        lobbyStatus: 'active',
        isOver: false, winner: null, overReason: null,
        selectedSquare: null, legalTargets: [],
        lastMove: null, capturedByWhite: [], capturedByBlack: [],
        events: ['🌐 Game started! May chaos reign...'],
        chatMessages: [], timerSeconds: 15,
        rematchOffered: false, opponentDisconnected: false,
      };
    }
    case 'SELECT': return { ...state, selectedSquare: action.sq, legalTargets: action.targets };
    case 'DESELECT': return { ...state, selectedSquare: null, legalTargets: [] };
    case 'MOVE_APPLIED': {
      const capW = action.mover === 'w' && action.captured ? [...state.capturedByWhite, action.captured] : state.capturedByWhite;
      const capB = action.mover === 'b' && action.captured ? [...state.capturedByBlack, action.captured] : state.capturedByBlack;
      return { ...state, fen: action.fen, selectedSquare: null, legalTargets: [], lastMove: { from: action.from, to: action.to }, capturedByWhite: capW, capturedByBlack: capB, pendingPromotion: null, timerSeconds: 15 };
    }
    case 'PHANTOM_APPLIED': {
      const capW = action.captured?.color === 'b' ? [...state.capturedByWhite, action.captured] : state.capturedByWhite;
      const capB = action.captured?.color === 'w' ? [...state.capturedByBlack, action.captured] : state.capturedByBlack;
      return { ...state, fen: action.fen, lastMove: { from: action.from, to: action.to }, capturedByWhite: capW, capturedByBlack: capB };
    }
    case 'SET_PENDING_PROMO': return { ...state, pendingPromotion: { from: action.from, to: action.to }, selectedSquare: null, legalTargets: [] };
    case 'CANCEL_PROMO': return { ...state, pendingPromotion: null };
    case 'TIMER_TICK': return { ...state, timerSeconds: Math.max(0, state.timerSeconds - 1) };
    case 'TIMER_RESET': return { ...state, timerSeconds: 15 };
    case 'ADD_EVENT': return { ...state, events: [...state.events.slice(-49), action.msg] };
    case 'ADD_CHAT': return { ...state, chatMessages: [...state.chatMessages, action.msg] };
    case 'GAME_OVER': return { ...state, isOver: true, winner: action.winner, overReason: action.reason };
    case 'REMATCH_OFFERED': return { ...state, rematchOffered: true };
    case 'REMATCH_ACCEPTED': return { ...state, fen: action.fen, isOver: false, winner: null, overReason: null, rematchOffered: false };
    case 'OPPONENT_DISCONNECTED': return { ...state, opponentDisconnected: true, events: [...state.events, '⚠️ Opponent disconnected. Waiting 30s...'] };
    case 'OPPONENT_RECONNECTED': return { ...state, opponentDisconnected: false, events: [...state.events, '✅ Opponent reconnected!'] };
    case 'RESET': return initialState(state.playerName);
    default: return state;
  }
}

function initialState(playerName = 'Player'): OnlineGameState {
  return {
    fen: new ChessEngine().fen,
    selectedSquare: null, legalTargets: [],
    lastMove: null, capturedByWhite: [], capturedByBlack: [],
    timerSeconds: 15, events: [], chatMessages: [],
    pendingPromotion: null, isOver: false, winner: null, overReason: null,
    roomCode: null, playerColor: null,
    playerName, opponentName: 'Opponent',
    connectionStatus: 'connecting', lobbyStatus: 'idle',
    rematchOffered: false, opponentDisconnected: false,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useOnlineGame(playerName = 'Player') {
  const [state, dispatch] = useReducer(reducer, playerName, initialState);
  const socketRef = useRef<Socket | null>(null);
  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    dispatch({ type: 'TIMER_RESET' });
    timerRef.current = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Boredom: signal server when timer hits 0
  useEffect(() => {
    if (state.timerSeconds === 0 && state.lobbyStatus === 'active' && !state.isOver) {
      stopTimer();
      const roomCode = state.roomCode;
      if (roomCode) socketRef.current?.emit('chaos-request', { roomId: roomCode });
      setTimeout(startTimer, 500);
    }
  }, [state.timerSeconds, state.lobbyStatus, state.isOver, state.roomCode, stopTimer, startTimer]);

  // Connect to Socket.io
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';
    const socket = io(url, { transports: ['websocket', 'polling'], autoConnect: true });
    socketRef.current = socket;

    socket.on('connect', () => dispatch({ type: 'SET_CONNECTION', status: 'connected' }));
    socket.on('disconnect', () => dispatch({ type: 'SET_CONNECTION', status: 'disconnected' }));
    socket.on('connect_error', () => dispatch({ type: 'SET_CONNECTION', status: 'error' }));

    socket.on('room-created', ({ roomId, color }: { roomId: string; color: Color }) => {
      dispatch({ type: 'ROOM_CREATED', code: roomId, color });
    });

    socket.on('room-joined', ({ color, opponentName }: { color: Color; opponentName: string }) => {
      dispatch({ type: 'GAME_START', fen: engineRef.current.fen, white: opponentName, black: playerName, playerColor: color });
    });

    socket.on('opponent-joined', ({ opponentName }: { opponentName: string }) => {
      dispatch({ type: 'ADD_EVENT', msg: `🌐 ${opponentName} joined the room!` });
    });

    socket.on('game-start', ({ fen, white, black }: { fen: string; white: string; black: string }) => {
      engineRef.current.load(fen);
      dispatch({ type: 'GAME_START', fen, white, black, playerColor: state.playerColor ?? 'w' });
      startTimer();
    });

    socket.on('move-made', ({ from, to, promotion, fen, san }: { from: string; to: string; promotion?: string; fen: string; san: string }) => {
      const engine = engineRef.current;
      const prevFen = engine.fen;
      engine.load(fen);
      // Detect capture: compare material
      const prevEngine = new ChessEngine(prevFen);
      const movedPiece = prevEngine.get(from);
      const capturedPiece = prevEngine.get(to);
      const mover = movedPiece?.color ?? 'w';
      isCaptureFen(prevFen, fen) ? playExplosion() : playAnimal();
      const captured: Piece | undefined = capturedPiece ?? undefined;
      dispatch({ type: 'MOVE_APPLIED', fen, from: from as Square, to: to as Square, mover, captured });
      startTimer();
    });

    socket.on('chaos-applied', ({ type, from, to, piece, fen, message }: { type: string; from: string; to: string; piece: Piece; fen: string; message: string }) => {
      const prevEngine = new ChessEngine(engineRef.current.fen);
      const capturedPiece = prevEngine.get(to) ?? undefined;
      engineRef.current.load(fen);
      playAnimal();
      dispatch({ type: 'PHANTOM_APPLIED', fen, from: from as Square, to: to as Square, captured: capturedPiece });
      dispatch({ type: 'ADD_EVENT', msg: message });
    });

    socket.on('chat-received', ({ player, text, timestamp }: ChatMessage) => {
      dispatch({ type: 'ADD_CHAT', msg: { player, text, timestamp } });
    });

    socket.on('game-over', ({ reason, winner }: { reason: OnlineGameState['overReason']; winner: Color | null }) => {
      stopTimer();
      dispatch({ type: 'GAME_OVER', winner, reason });
    });

    socket.on('rematch-offered', () => dispatch({ type: 'REMATCH_OFFERED' }));
    socket.on('rematch-accepted', ({ fen }: { fen: string }) => {
      engineRef.current.load(fen);
      dispatch({ type: 'REMATCH_ACCEPTED', fen });
      startTimer();
    });
    socket.on('opponent-disconnected', () => dispatch({ type: 'OPPONENT_DISCONNECTED' }));
    socket.on('opponent-reconnected', () => dispatch({ type: 'OPPONENT_RECONNECTED' }));
    socket.on('error', ({ message }: { message: string }) => {
      dispatch({ type: 'ADD_EVENT', msg: `❌ ${message}` });
    });

    return () => { socket.disconnect(); stopTimer(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    dispatch({ type: 'SET_LOBBY', status: 'creating' });
    socketRef.current?.emit('create-room', { playerName });
  }, [playerName]);

  const joinRoom = useCallback((code: string) => {
    dispatch({ type: 'SET_LOBBY', status: 'joining' });
    socketRef.current?.emit('join-room', { roomId: code.toUpperCase(), playerName });
  }, [playerName]);

  const onSquareClick = useCallback((sq: Square) => {
    if (state.isOver || state.lobbyStatus !== 'active' || state.pendingPromotion) return;
    const engine = engineRef.current;
    const playerColor = state.playerColor;
    if (!playerColor || engine.turn !== playerColor) return;

    const piece = engine.get(sq);
    const { selectedSquare, legalTargets } = state;

    if (selectedSquare) {
      if (legalTargets.includes(sq)) {
        const mvs = engine.legalMoves(selectedSquare);
        const mv = mvs.find(m => m.to === sq);
        if (mv?.flags?.includes('p')) {
          dispatch({ type: 'SET_PENDING_PROMO', from: selectedSquare, to: sq });
          return;
        }
        socketRef.current?.emit('move', { roomId: state.roomCode, from: selectedSquare, to: sq });
        return;
      }
      if (piece && piece.color === playerColor) {
        const mvs = engine.legalMoves(sq);
        dispatch({ type: 'SELECT', sq, targets: mvs.map(m => m.to as Square) });
        return;
      }
      dispatch({ type: 'DESELECT' });
      return;
    }

    if (piece && piece.color === playerColor) {
      const mvs = engine.legalMoves(sq);
      dispatch({ type: 'SELECT', sq, targets: mvs.map(m => m.to as Square) });
    }
  }, [state]);

  const onPromotion = useCallback((piece: string) => {
    if (!state.pendingPromotion || !state.roomCode) return;
    const { from, to } = state.pendingPromotion;
    socketRef.current?.emit('move', { roomId: state.roomCode, from, to, promotion: piece });
    dispatch({ type: 'CANCEL_PROMO' });
  }, [state.pendingPromotion, state.roomCode]);

  const onTrashTalk = useCallback((player: Color, text: string) => {
    if (!state.roomCode) return;
    socketRef.current?.emit('chat-message', { roomId: state.roomCode, player, text });
  }, [state.roomCode]);

  const onRematchOffer = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current?.emit('rematch-offer', { roomId: state.roomCode });
  }, [state.roomCode]);

  const onRematchAccept = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current?.emit('rematch-accept', { roomId: state.roomCode });
  }, [state.roomCode]);

  const onReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    engineRef.current = new ChessEngine();
  }, []);

  const derivedEngine = new ChessEngine(state.fen);

  return {
    engine: derivedEngine,
    fen: state.fen,
    turn: derivedEngine.turn,
    inCheck: derivedEngine.inCheck,
    isCheckmate: derivedEngine.isCheckmate,
    isStalemate: derivedEngine.isStalemate,
    isDraw: derivedEngine.isDraw,
    isGameOver: state.isOver,
    winner: state.winner,
    overReason: state.overReason,
    selectedSquare: state.selectedSquare,
    legalTargets: state.legalTargets,
    lastMove: state.lastMove,
    capturedByWhite: state.capturedByWhite,
    capturedByBlack: state.capturedByBlack,
    timerSeconds: state.timerSeconds,
    events: state.events,
    chatMessages: state.chatMessages,
    pendingPromotion: state.pendingPromotion,
    moveHistory: derivedEngine.getHistory(false) as unknown as string[],
    // Online-specific
    roomCode: state.roomCode,
    playerColor: state.playerColor,
    opponentName: state.opponentName,
    connectionStatus: state.connectionStatus,
    lobbyStatus: state.lobbyStatus,
    rematchOffered: state.rematchOffered,
    opponentDisconnected: state.opponentDisconnected,
    // Actions
    createRoom,
    joinRoom,
    onSquareClick,
    onPromotion,
    onTrashTalk,
    onRematchOffer,
    onRematchAccept,
    onReset,
    mode: 'online' as const,
  };
}

function isCaptureFen(before: string, after: string): boolean {
  const countPieces = (fen: string) => {
    let count = 0;
    for (const ch of fen.split(' ')[0]) {
      if (/[pnbrqkPNBRQK]/.test(ch)) count++;
    }
    return count;
  };
  return countPieces(after) < countPieces(before);
}

export type OnlineGame = ReturnType<typeof useOnlineGame>;
