'use client';
import { useState } from 'react';
import { useLocalGame } from '@/hooks/useLocalGame';
import { Board } from '@/components/Board';
import { Sidebar } from '@/components/Sidebar';
import { GameOverModal } from '@/components/GameOverModal';
import { PromotionModal } from '@/components/PromotionModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';

export default function LocalPage() {
  const game = useLocalGame();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  return (
    <>
      <div className="game-layout">
        <Board
          engine={game.engine}
          selectedSquare={game.selectedSquare}
          legalTargets={game.legalTargets}
          lastMove={game.lastMove}
          onSquareClick={game.onSquareClick}
          mode="local"
          flipped={autoRotate && game.turn === 'b'}
          animated={autoRotate}
          lastCaptureSq={game.lastCaptureSq}
        />
        <Sidebar
          turn={game.turn}
          inCheck={game.inCheck}
          isCheckmate={game.isCheckmate}
          isStalemate={game.isStalemate}
          isDraw={game.isDraw}
          timerSeconds={game.timerSeconds}
          capturedByWhite={game.capturedByWhite}
          capturedByBlack={game.capturedByBlack}
          moveHistory={game.moveHistory}
          events={game.events}
          chatMessages={game.chatMessages}
          onTrashTalk={game.onTrashTalk}
          extraPanel={
            <button
              onClick={() => setAutoRotate(v => !v)}
              style={{
                background: autoRotate ? 'rgba(124,77,255,0.18)' : 'var(--surface2)',
                border: `1px solid ${autoRotate ? 'var(--accent3)' : 'var(--surface3)'}`,
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                color: autoRotate ? 'var(--accent3)' : 'var(--text-dim)',
                fontSize: '0.78rem', fontWeight: 600,
                transition: 'background 0.15s, color 0.15s',
                width: '100%',
              }}
            >
              🔄 Auto-rotate board {autoRotate ? 'ON' : 'OFF'}
            </button>
          }
        />
      </div>

      <GameOverModal
        show={game.isGameOver}
        winner={game.winner}
        reason={game.overReason}
        onPlayAgain={game.onReset}
        onMenu={() => setShowConfirm(true)}
      />

      <PromotionModal
        show={!!game.pendingPromotion}
        color={game.turn}
        onChoose={game.onPromotion}
      />

      <ConfirmModal
        show={showConfirm}
        title="Leave game? 🚪"
        message="You'll lose this game's progress. The pieces will be heartbroken."
        confirmLabel="Yes, leave"
        cancelLabel="Stay"
        onConfirm={() => router.push('/')}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
