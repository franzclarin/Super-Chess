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
  // BUG-005: track game version to cancel stale bot moves after reset
  const gameVersionRef = useRef(0);

  const botColor: Color = humanColor === 'w' ? 'b' : 'w';

  // BUG-004: stop the timer while it's the bot's turn to prevent boredom shuffle
  useEffect(() => {
    if (game.isGameOver) return;
    if (game.turn === botColor) {
      game.stopTimer();
    }
  }, [game.turn, game.isGameOver, botColor, game.stopTimer]);

  // Trigger bot move whenever it's the bot's turn
  useEffect(() => {
    if (game.isGameOver) return;
    if (game.turn !== botColor) return;
    if (botThinkingRef.current) return;
    if (game.pendingPromotion) return;

    botThinkingRef.current = true;
    const myVersion = gameVersionRef.current;

    async function think() {
      // Slight delay so the UI updates before bot moves
      await new Promise(r => setTimeout(r, difficulty === 'kitten' ? 400 : 700));

      // BUG-005: abort if reset happened while thinking
      if (gameVersionRef.current !== myVersion) { botThinkingRef.current = false; return; }
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

      // BUG-005: check version again after any async awaits
      if (gameVersionRef.current !== myVersion) { botThinkingRef.current = false; return; }

      if (move) {
        // BUG-001: apply move directly instead of simulating UI clicks
        game.applyMove(move.from as Square, move.to as Square, move.promotion ?? undefined);
        botThinkingRef.current = false;

        // Bot trash talk (40% chance)
        if (Math.random() < 0.40) {
          const lines = difficulty === 'kitten' && Math.random() < 0.4
            ? KITTEN_SELF_HYPE
            : BOT_TRASH_TALK;
          const text = lines[Math.floor(Math.random() * lines.length)];
          game.onTrashTalk(botColor, text);
        }
      } else {
        botThinkingRef.current = false;
      }
    }

    think();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, game.turn, game.isGameOver]);

  // BUG-005: wrap onReset to increment version and clear botThinkingRef
  const onReset = useCallback(() => {
    gameVersionRef.current++;
    botThinkingRef.current = false;
    game.onReset();
  }, [game.onReset]);

  return {
    ...game,
    humanColor,
    botColor,
    difficulty,
    stockfishReady: stockfish.isReady,
    stockfishThinking: stockfish.isThinking,
    stockfishError: stockfish.error,
    mode: 'bot' as const,
    onReset,
    // Suppress timer display for bot's turn
    timerSeconds: game.turn === humanColor ? game.timerSeconds : 15,
  };
}

export type BotGame = ReturnType<typeof useBotGame>;
