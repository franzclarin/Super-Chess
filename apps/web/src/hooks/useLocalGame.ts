'use client';
import { useReducer, useEffect, useRef, useCallback } from 'react';
import { ChessEngine, applyPhantomMove } from '@super-chess/chess-core';
import type { Color, Piece, Square, Move, ChatMessage } from '@super-chess/chess-core';
import { playAnimal, playExplosion } from '@/lib/sounds';
import { pieceChar, PIECE_NAMES } from '@/lib/constants';

// ─── State ─────────────────────────────────────────────────────────────────

export interface LocalGameState {
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
  overReason: 'checkmate' | 'stalemate' | 'draw' | null;
}

type Action =
  | { type: 'SELECT'; sq: Square; targets: Square[] }
  | { type: 'DESELECT' }
  | { type: 'MOVE_DONE'; fen: string; from: Square; to: Square; captured?: Piece; mover: Color }
  | { type: 'PHANTOM_DONE'; fen: string; from: Square; to: Square; captured?: Piece }
  | { type: 'SET_PENDING_PROMO'; from: Square; to: Square }
  | { type: 'CANCEL_PROMO' }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_RESET' }
  | { type: 'ADD_EVENT'; msg: string }
  | { type: 'ADD_CHAT'; msg: ChatMessage }
  | { type: 'GAME_OVER'; winner: Color | null; reason: 'checkmate' | 'stalemate' | 'draw' }
  | { type: 'RESET'; fen: string };

function reducer(state: LocalGameState, action: Action): LocalGameState {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selectedSquare: action.sq, legalTargets: action.targets };
    case 'DESELECT':
      return { ...state, selectedSquare: null, legalTargets: [] };
    case 'MOVE_DONE': {
      const capW = action.mover === 'w' && action.captured
        ? [...state.capturedByWhite, action.captured]
        : state.capturedByWhite;
      const capB = action.mover === 'b' && action.captured
        ? [...state.capturedByBlack, action.captured]
        : state.capturedByBlack;
      return {
        ...state,
        fen: action.fen,
        selectedSquare: null,
        legalTargets: [],
        lastMove: { from: action.from, to: action.to },
        capturedByWhite: capW,
        capturedByBlack: capB,
        pendingPromotion: null,
        timerSeconds: 15,
      };
    }
    case 'PHANTOM_DONE': {
      const capW = action.captured?.color === 'b'
        ? [...state.capturedByWhite, action.captured]
        : state.capturedByWhite;
      const capB = action.captured?.color === 'w'
        ? [...state.capturedByBlack, action.captured]
        : state.capturedByBlack;
      return {
        ...state,
        fen: action.fen,
        lastMove: { from: action.from, to: action.to },
        capturedByWhite: capW,
        capturedByBlack: capB,
      };
    }
    case 'SET_PENDING_PROMO':
      return { ...state, pendingPromotion: { from: action.from, to: action.to }, selectedSquare: null, legalTargets: [] };
    case 'CANCEL_PROMO':
      return { ...state, pendingPromotion: null };
    case 'TIMER_TICK':
      return { ...state, timerSeconds: Math.max(0, state.timerSeconds - 1) };
    case 'TIMER_RESET':
      return { ...state, timerSeconds: 15 };
    case 'ADD_EVENT':
      return { ...state, events: [...state.events.slice(-49), action.msg] };
    case 'ADD_CHAT':
      return { ...state, chatMessages: [...state.chatMessages, action.msg] };
    case 'GAME_OVER':
      return { ...state, isOver: true, winner: action.winner, overReason: action.reason };
    case 'RESET':
      return { ...initialState(), fen: action.fen };
    default:
      return state;
  }
}

function initialState(): LocalGameState {
  return {
    fen: new ChessEngine().fen,
    selectedSquare: null,
    legalTargets: [],
    lastMove: null,
    capturedByWhite: [],
    capturedByBlack: [],
    timerSeconds: 15,
    events: [],
    chatMessages: [],
    pendingPromotion: null,
    isOver: false,
    winner: null,
    overReason: null,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useLocalGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driftTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engine = engineRef.current;

  // ── Timer ────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    dispatch({ type: 'TIMER_RESET' });
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TIMER_TICK' });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Watch timerSeconds for boredom trigger
  useEffect(() => {
    if (state.timerSeconds === 0 && !state.isOver) {
      stopTimer();
      doBoredomShuffle();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerSeconds, state.isOver]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function addEvent(msg: string) { dispatch({ type: 'ADD_EVENT', msg }); }

  function checkGameOver(): boolean {
    if (engine.isGameOver) {
      stopTimer();
      let winner: Color | null = null;
      let reason: 'checkmate' | 'stalemate' | 'draw' = 'draw';
      if (engine.isCheckmate) { reason = 'checkmate'; winner = engine.turn === 'w' ? 'b' : 'w'; }
      else if (engine.isStalemate) { reason = 'stalemate'; }
      dispatch({ type: 'GAME_OVER', winner, reason });
      return true;
    }
    return false;
  }

  function maybeDrift() {
    if (engine.isGameOver) return;
    if (Math.random() > 0.20) return;

    const candidates: Array<{ sq: Square; piece: Piece; moves: Move[] }> = [];
    for (const color of ['w', 'b'] as Color[]) {
      const parts = engine.fen.split(' ');
      parts[1] = color; parts[3] = '-';
      const tmp = new ChessEngine();
      tmp.load(parts.join(' '));
      for (const rank of '87654321') {
        for (const file of 'abcdefgh') {
          const sq = file + rank;
          const p = tmp.get(sq);
          if (p && p.color === color) {
            const mvs = tmp.legalMoves(sq);
            if (mvs.length) candidates.push({ sq, piece: p, moves: mvs });
          }
        }
      }
    }
    if (!candidates.length) return;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const mv = chosen.moves[Math.floor(Math.random() * chosen.moves.length)];
    const promo = mv.flags?.includes('p') ? 'q' : undefined;
    const result = applyPhantomMove(engine, chosen.sq, mv.to as Square, chosen.piece.color, promo);
    if (!result) return;

    playAnimal();
    dispatch({
      type: 'PHANTOM_DONE',
      fen: engine.fen,
      from: chosen.sq,
      to: mv.to as Square,
      captured: result.capturedPiece,
    });
    const pName = `${chosen.piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[chosen.piece.type]}`;
    addEvent(`✨ ${pName} had a mind of its own and drifted to ${mv.to}!`);
    checkGameOver();
  }

  function doBoredomShuffle() {
    if (engine.isGameOver) return;
    const turn = engine.turn;
    addEvent(`😴 ${turn === 'w' ? 'White' : 'Black'} was AFK — their pieces revolted!`);

    const pieces: Array<{ sq: Square; piece: Piece; moves: Move[] }> = [];
    for (const rank of '87654321') {
      for (const file of 'abcdefgh') {
        const sq = file + rank;
        const p = engine.get(sq);
        if (p && p.color === turn) {
          const mvs = engine.legalMoves(sq);
          if (mvs.length) pieces.push({ sq, piece: p, moves: mvs });
        }
      }
    }
    if (!pieces.length) { startTimer(); return; }

    const count = Math.min(1 + (Math.random() < 0.5 ? 1 : 0), pieces.length);
    const chosen = [...pieces].sort(() => Math.random() - 0.5).slice(0, count);

    chosen.forEach(({ sq, piece }, idx) => {
      setTimeout(() => {
        if (engine.isGameOver) return;
        const parts = engine.fen.split(' ');
        parts[1] = piece.color; parts[3] = '-';
        const tmp = new ChessEngine();
        tmp.load(parts.join(' '));
        const mvs = tmp.legalMoves(sq);
        if (!mvs.length) return;
        const mv = mvs[Math.floor(Math.random() * mvs.length)];
        const promo = mv.flags?.includes('p') ? 'q' : undefined;
        const result = applyPhantomMove(engine, sq, mv.to as Square, piece.color, promo);
        if (!result) return;

        playAnimal();
        dispatch({ type: 'PHANTOM_DONE', fen: engine.fen, from: sq, to: mv.to as Square, captured: result.capturedPiece });
        const pName = `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}`;
        addEvent(`😴 ${pName} got bored and wandered to ${mv.to}!`);
        checkGameOver();

        if (idx === chosen.length - 1) { startTimer(); }
      }, idx * 700);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function applyMove(from: Square, to: Square, promotion?: string) {
    const result = engine.move({ from, to, promotion });
    if (!result) return;

    const isCapture = !!result.captured || result.flags?.includes('e');
    isCapture ? playExplosion() : playAnimal();

    const captured: Piece | undefined = result.captured
      ? { type: result.captured, color: result.color === 'w' ? 'b' : 'w' }
      : result.flags?.includes('e')
        ? { type: 'p', color: result.color === 'w' ? 'b' : 'w' }
        : undefined;

    dispatch({
      type: 'MOVE_DONE',
      fen: engine.fen,
      from: result.from,
      to: result.to,
      captured,
      mover: result.color,
    });

    if (checkGameOver()) return;
    startTimer();

    driftTimeout.current && clearTimeout(driftTimeout.current);
    driftTimeout.current = setTimeout(maybeDrift, 550);
  }

  const onSquareClick = useCallback((sq: Square) => {
    if (state.isOver || state.pendingPromotion) return;

    const piece = engine.get(sq);
    const { selectedSquare, legalTargets } = state;

    if (selectedSquare) {
      if (legalTargets.includes(sq)) {
        // Check for promotion
        const mvs = engine.legalMoves(selectedSquare);
        const mv = mvs.find(m => m.to === sq);
        if (mv?.flags?.includes('p')) {
          dispatch({ type: 'SET_PENDING_PROMO', from: selectedSquare, to: sq });
          return;
        }
        applyMove(selectedSquare, sq);
        return;
      }
      if (piece && piece.color === engine.turn) {
        const mvs = engine.legalMoves(sq);
        dispatch({ type: 'SELECT', sq, targets: mvs.map(m => m.to as Square) });
        return;
      }
      dispatch({ type: 'DESELECT' });
      return;
    }

    if (piece && piece.color === engine.turn) {
      const mvs = engine.legalMoves(sq);
      dispatch({ type: 'SELECT', sq, targets: mvs.map(m => m.to as Square) });
    }
  }, [state, engine]);

  const onPromotion = useCallback((piece: string) => {
    if (!state.pendingPromotion) return;
    const { from, to } = state.pendingPromotion;
    applyMove(from, to, piece);
  }, [state.pendingPromotion]);

  const onTrashTalk = useCallback((player: Color, text: string) => {
    dispatch({ type: 'ADD_CHAT', msg: { player, text, timestamp: Date.now() } });
  }, []);

  const onReset = useCallback(() => {
    stopTimer();
    if (driftTimeout.current) clearTimeout(driftTimeout.current);
    engineRef.current = new ChessEngine();
    dispatch({ type: 'RESET', fen: engineRef.current.fen });
    setTimeout(startTimer, 100);
  }, [stopTimer, startTimer]);

  // Start timer on mount
  useEffect(() => {
    startTimer();
    addEvent('🐾 Welcome to Super Chess — Chaos Edition!');
    addEvent('⏱️ 15s per move or your pieces revolt. Good luck.');
    return () => { stopTimer(); if (driftTimeout.current) clearTimeout(driftTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive board from FEN
  const derivedEngine = new ChessEngine(state.fen);

  return {
    // Board state
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
    // UI state
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
    // Actions
    onSquareClick,
    onPromotion,
    onTrashTalk,
    onReset,
    mode: 'local' as const,
  };
}

export type LocalGame = ReturnType<typeof useLocalGame>;
