import type { Color } from '@super-chess/chess-core';

export const UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export function pieceChar(type: string, color: Color): string {
  return UNICODE[color + type.toUpperCase()] ?? '';
}

export const PIECE_NAMES: Record<string, string> = {
  k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
};

export const FILES = ['a','b','c','d','e','f','g','h'] as const;
export const RANKS = ['8','7','6','5','4','3','2','1'] as const;

export const WHITE_TRASH_TALK = [
  { e: '🎩', t: "Your opening is giving me secondhand embarrassment." },
  { e: '🔭', t: "I've seen better strategy in a coin flip." },
  { e: '😏', t: "Checked your king? Or just... vibing?" },
  { e: '🤏', t: "That move was bold. I'll grant you that." },
  { e: '🧐', t: "I expected more from the other side of the board." },
  { e: '🫖', t: "My butler plays better than you on his day off." },
  { e: '📜', t: "Fascinating. A completely suboptimal choice." },
  { e: '😢', t: "One must pity the pieces under your command." },
  { e: '💅', t: "Are you blundering on purpose? As an art form?" },
  { e: '📚', t: "Perhaps chess is not your calling, darling." },
];

export const BLACK_TRASH_TALK = [
  { e: '🐱', t: "My cat could play better than you." },
  { e: '💀', t: "Bro really said 'chess is a thinking game' 💀" },
  { e: '🤡', t: "Are you sure you meant to do that? 👀" },
  { e: '😭', t: "That piece is literally crying rn." },
  { e: '🚫', t: "This ain't it, chief." },
  { e: '🤦', t: "Bro walked right into that one." },
  { e: '🐛', t: "Is this a glitch or are you just bad?" },
  { e: '😤', t: "The audacity. The nerve. The delusion." },
  { e: '⛔', t: "Chess.com would ban you for this behavior." },
  { e: '🙏', t: "Your pieces are literally begging to be captured." },
];

export const BOT_TRASH_TALK = [
  "beep boop: your position is suboptimal.",
  "my neural nets are embarrassed for you.",
  "i have calculated every possible outcome. they're all bad for you.",
  "ERROR: opponent_skill.exe not found",
  "please consider checkers as an alternative career.",
  "*robot noises* your blunder feeds my training data 🤖",
  "i would say good move but i'm programmed to be honest.",
  "400 billion calculations per second and you still surprised me. not in a good way.",
];

export const KITTEN_SELF_HYPE = [
  "omg im doing so good!!!",
  "is this what winning feels like 🐾",
  "i moved a piece!! i'm basically grandmaster",
  "meow meow tactical genius meow",
  "my moves make no sense and i've never been happier",
  "i just put a piece there because i liked the square",
];

export const DIFFICULTY_INFO = {
  kitten: {
    icon: '🐱',
    name: 'Kitten',
    desc: 'Moves randomly. Occasionally ignores check. Has a great time.',
    color: '#f5a623',
  },
  puppy: {
    icon: '🐶',
    name: 'Puppy',
    desc: 'Loves to capture things. Does not think ahead. Very enthusiastic.',
    color: '#4caf50',
  },
  fox: {
    icon: '🦊',
    name: 'Fox',
    desc: 'Minimax depth-3. Cunning. Will make you feel the pressure.',
    color: '#e94560',
  },
  eagle: {
    icon: '🦅',
    name: 'Eagle',
    desc: 'Stockfish WASM. Skill 15/20. Godlike. Good luck.',
    color: '#7c4dff',
  },
} as const;
