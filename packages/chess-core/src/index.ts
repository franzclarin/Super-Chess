import { Chess } from 'chess.js';
import type { Square as CJSquare } from 'chess.js';
import type { Color, Piece, PieceType, Square, Move, GameState, BoardState } from './types';

export * from './types';

// ─── Chess Engine Wrapper ──────────────────────────────────────────────────

export class ChessEngine {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess();
    if (fen) this.chess.load(fen);
  }

  get fen(): string { return this.chess.fen(); }
  get turn(): Color { return this.chess.turn() as Color; }
  get inCheck(): boolean { return this.chess.isCheck(); }
  get isCheckmate(): boolean { return this.chess.isCheckmate(); }
  get isStalemate(): boolean { return this.chess.isStalemate(); }
  get isDraw(): boolean { return this.chess.isDraw(); }
  get isGameOver(): boolean { return this.chess.isGameOver(); }

  move(moveObj: { from: string; to: string; promotion?: string }): Move | null {
    try {
      return this.chess.move(moveObj) as unknown as Move;
    } catch {
      return null;
    }
  }

  legalMoves(square?: string): Move[] {
    const opts = square
      ? { square: square as CJSquare, verbose: true }
      : { verbose: true };
    return (this.chess.moves(opts) as unknown) as Move[];
  }

  get(square: string): Piece | null {
    const p = this.chess.get(square as CJSquare);
    return p ? { type: p.type as PieceType, color: p.color as Color } : null;
  }

  getBoard(): BoardState {
    return this.chess.board().map(row =>
      row.map(sq => sq ? { type: sq.type as PieceType, color: sq.color as Color } : null)
    );
  }

  getHistory(verbose = false): Move[] {
    return (this.chess.history({ verbose }) as unknown) as Move[];
  }

  load(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  undo(): Move | null {
    const m = this.chess.undo();
    return m ? (m as unknown as Move) : null;
  }

  reset(): void {
    this.chess.reset();
  }

  getState(): GameState {
    return {
      board: this.getBoard(),
      turn: this.turn,
      inCheck: this.inCheck,
      isCheckmate: this.isCheckmate,
      isStalemate: this.isStalemate,
      isDraw: this.isDraw,
      isGameOver: this.isGameOver,
      fen: this.fen,
      history: this.getHistory(true),
    };
  }

  clone(): ChessEngine {
    return new ChessEngine(this.fen);
  }
}

// ─── Phantom Move ──────────────────────────────────────────────────────────
// Apply a move without changing whose turn it is (used for drift/boredom).
// Returns the Move result + any captured piece, or null on failure.

export interface PhantomResult {
  move: Move;
  capturedPiece?: Piece;
}

export function applyPhantomMove(
  engine: ChessEngine,
  from: Square,
  to: Square,
  pieceColor: Color,
  promotion?: string
): PhantomResult | null {
  const origTurn = engine.turn;
  const parts = engine.fen.split(' ');

  // Swap turn so this piece can legally move; clear en passant
  parts[1] = pieceColor;
  parts[3] = '-';

  const temp = new Chess();
  try {
    temp.load(parts.join(' '), { skipValidation: true });
  } catch {
    return null;
  }

  let result: Move;
  try {
    result = (temp.move({ from, to, promotion: promotion as PieceType | undefined }) as unknown) as Move;
  } catch {
    return null;
  }

  const capturedPiece: Piece | undefined = result.captured
    ? { type: result.captured, color: (result.color === 'w' ? 'b' : 'w') as Color }
    : undefined;

  // Restore original turn in the resulting position
  const newParts = temp.fen().split(' ');
  newParts[1] = origTurn;
  newParts[3] = '-';
  engine.load(newParts.join(' '));

  return { move: result, capturedPiece };
}

// ─── Bot Logic ─────────────────────────────────────────────────────────────

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables (from White's perspective, rank 0 = rank 8)
const PST: Record<PieceType, number[][]> = {
  p: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [ 50, 50, 50, 50, 50, 50, 50, 50],
    [ 10, 10, 20, 30, 30, 20, 10, 10],
    [  5,  5, 10, 25, 25, 10,  5,  5],
    [  0,  0,  0, 20, 20,  0,  0,  0],
    [  5, -5,-10,  0,  0,-10, -5,  5],
    [  5, 10, 10,-20,-20, 10, 10,  5],
    [  0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = board[rank][file];
      if (!sq) continue;
      const type = sq.type as PieceType;
      const val = PIECE_VALUES[type];
      const pstRow = sq.color === 'w' ? rank : 7 - rank;
      const pst = PST[type][pstRow][file];
      score += sq.color === 'w' ? val + pst : -(val + pst);
    }
  }
  return score;
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) {
    if (chess.isCheckmate()) return -100000 + (3 - depth) * 100;
    if (chess.isDraw()) return 0;
    const raw = evaluate(chess);
    return chess.turn() === 'w' ? raw : -raw;
  }

  const moves = chess.moves({ verbose: true });
  for (const mv of moves) {
    chess.move(mv);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return alpha;
}

export interface BotMove {
  from: Square;
  to: Square;
  promotion?: string;
}

export function getBotMove(fen: string, level: string): BotMove | null {
  const chess = new Chess();
  try {
    chess.load(fen);
  } catch {
    return null;
  }

  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  if (level === 'kitten') {
    // Random move; 15% chance plays random even in check (chaos tax)
    if (chess.isCheck() && Math.random() < 0.15) {
      const mv = moves[Math.floor(Math.random() * moves.length)];
      return { from: mv.from, to: mv.to, promotion: mv.promotion };
    }
    const mv = moves[Math.floor(Math.random() * moves.length)];
    return { from: mv.from, to: mv.to, promotion: mv.promotion };
  }

  if (level === 'puppy') {
    // Prefer highest-value capture; else random
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0) {
      captures.sort((a, b) =>
        PIECE_VALUES[(b.captured as PieceType) ?? 'p'] -
        PIECE_VALUES[(a.captured as PieceType) ?? 'p']
      );
      const mv = captures[0];
      return { from: mv.from, to: mv.to, promotion: mv.promotion ?? 'q' };
    }
    const mv = moves[Math.floor(Math.random() * moves.length)];
    return { from: mv.from, to: mv.to, promotion: mv.promotion };
  }

  if (level === 'fox') {
    // Minimax depth 3 with alpha-beta
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const mv of moves) {
      chess.move(mv);
      const score = -negamax(chess, 2, -Infinity, Infinity);
      chess.undo();
      if (score > bestScore) {
        bestScore = score;
        bestMove = mv;
      }
    }
    return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion ?? 'q' };
  }

  // Eagle: handled via Stockfish Worker in the browser — fallback to fox
  return getBotMove(fen, 'fox');
}
