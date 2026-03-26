export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Square = string; // 'a1' .. 'h8'

export interface Move {
  color: Color;
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  flags: string;
  san: string;
  lan: string;
  before: string;
  after: string;
}

export type BoardState = (Piece | null)[][];

export interface GameState {
  board: BoardState;
  turn: Color;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  fen: string;
  history: Move[];
}

export type BotLevel = 'kitten' | 'puppy' | 'fox' | 'eagle';

export interface ChatMessage {
  player: Color;
  text: string;
  timestamp: number;
}

export interface RoomPlayer {
  socketId: string;
  name: string;
  color: Color;
  connected: boolean;
}

export interface RoomState {
  id: string;
  fen: string;
  status: 'waiting' | 'active' | 'finished';
  players: {
    w: RoomPlayer | null;
    b: RoomPlayer | null;
  };
  createdAt: number;
  lastActivityAt: number;
}

// Socket.io event payloads
export interface ServerToClientEvents {
  'room-created': (data: { roomId: string; color: Color }) => void;
  'room-joined': (data: { color: Color; opponentName: string }) => void;
  'opponent-joined': (data: { opponentName: string; color: Color }) => void;
  'game-start': (data: { fen: string; white: string; black: string }) => void;
  'move-made': (data: { from: Square; to: Square; promotion?: string; fen: string; san: string }) => void;
  'chaos-applied': (data: { type: 'drift' | 'boredom'; from: Square; to: Square; piece: Piece; fen: string; message: string }) => void;
  'chat-received': (data: { player: Color; text: string; timestamp: number }) => void;
  'game-over': (data: { reason: 'checkmate' | 'stalemate' | 'draw' | 'resign' | 'abandonment'; winner: Color | null }) => void;
  'rematch-offered': () => void;
  'rematch-accepted': (data: { fen: string }) => void;
  'opponent-disconnected': () => void;
  'opponent-reconnected': () => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'create-room': (data: { playerName: string }) => void;
  'join-room': (data: { roomId: string; playerName: string }) => void;
  'move': (data: { roomId: string; from: Square; to: Square; promotion?: string }) => void;
  'chaos-request': (data: { roomId: string }) => void;
  'chat-message': (data: { roomId: string; player: Color; text: string }) => void;
  'resign': (data: { roomId: string }) => void;
  'rematch-offer': (data: { roomId: string }) => void;
  'rematch-accept': (data: { roomId: string }) => void;
  'reconnect-game': (data: { roomId: string }) => void;
}
