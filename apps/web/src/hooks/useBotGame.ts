'use client';
import { useCallback, useEffect, useRef } from 'react';
import { getBotMove } from '@super-chess/chess-core';
import type { Color, BotLevel, Square } from '@super-chess/chess-core';
import { useLocalGame } from './useLocalGame';
import { useStockfish } from './useStockfish';
import { playAnimal } from '@/lib/sounds';
import { BOT_TRASH_TALK, KITTEN_SELF_HYPE } from '@/lib/constants';

export function useBotGame(difficulty: BotLevel, humanColor: Color = 'w') {
  const game = useLocalGame();
  const stockfish = useStockfish();
  const botThinkingRef = useRef(false);

  const botColor: Color = humanColor === 'w' ? 'b' : 'w';

  // Trigger bot move whenever it's the bot's turn
  useEffect(() => {
    if (game.isGameOver) return;
    if (game.turn !== botColor) return;
    if (botThinkingRef.current) return;
    if (game.pendingPromotion) return;

    botThinkingRef.current = true;

    async function think() {
      // Slight delay so the UI updates before bot moves
      await new Promise(r => setTimeout(r, difficulty === 'kitten' ? 400 : 700));

      if (game.isGameOver) { botThinkingRef.current = false; return; }

      let move: { from: string; to: string; promotion?: string } | null = null;

      if (difficulty === 'eagle') {
        const uciMove = await stockfish.getBestMove(game.fen, 1500);
        if (uciMove && uciMove.length >= 4) {
          move = {
            from: uciMove.slice(0, 2) as Square,
            to: uciMove.slice(2, 4) as Square,
            promotion: uciMove[4] || undefined,
          };
        }
      }

      // Fallback to chess-core bots (eagle falls back to fox if Stockfish not ready)
      if (!move) {
        move = getBotMove(game.fen, difficulty === 'eagle' ? 'fox' : difficulty);
      }

      if (move) {
        game.onSquareClick(move.from as Square);
        // Direct engine call since bot doesn't go through click UI
        // We use a slight hack: click from, then click to
        setTimeout(() => {
          if (game.isGameOver) { botThinkingRef.current = false; return; }
          // The click system requires the piece to be selected first
          // For bot moves we directly trigger by clicking from → to
          // Since useLocalGame onClick requires piece selected first,
          // we emit both clicks in sequence
          game.onSquareClick(move!.from as Square);
          setTimeout(() => {
            if (!game.isGameOver) {
              if (move!.promotion) {
                game.onSquareClick(move!.to as Square);
                setTimeout(() => game.onPromotion(move!.promotion ?? 'q'), 50);
              } else {
                game.onSquareClick(move!.to as Square);
              }
            }
            botThinkingRef.current = false;

            // Bot trash talk (40% chance)
            if (Math.random() < 0.40) {
              const lines = difficulty === 'kitten' && Math.random() < 0.4
                ? KITTEN_SELF_HYPE
                : BOT_TRASH_TALK;
              const text = lines[Math.floor(Math.random() * lines.length)];
              game.onTrashTalk(botColor, text);
            }
          }, 80);
        }, 40);
      } else {
        botThinkingRef.current = false;
      }
    }

    think();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, game.turn, game.isGameOver]);

  return {
    ...game,
    humanColor,
    botColor,
    difficulty,
    stockfishReady: stockfish.isReady,
    stockfishThinking: stockfish.isThinking,
    stockfishError: stockfish.error,
    mode: 'bot' as const,
    // Suppress timer for bot's turn
    timerSeconds: game.turn === humanColor ? game.timerSeconds : 15,
  };
}

export type BotGame = ReturnType<typeof useBotGame>;
