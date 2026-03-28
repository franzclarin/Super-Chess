'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBotGame } from '@/hooks/useBotGame';
import { Board } from '@/components/Board';
import { Sidebar } from '@/components/Sidebar';
import { GameOverModal } from '@/components/GameOverModal';
import { PromotionModal } from '@/components/PromotionModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DIFFICULTY_INFO } from '@/lib/constants';
import type { BotLevel, Color } from '@super-chess/chess-core';

const LEVELS: BotLevel[] = ['kitten', 'puppy', 'fox', 'eagle'];

function DifficultyPicker({
  onStart,
}: {
  onStart: (level: BotLevel, color: Color) => void;
}) {
  const [selected, setSelected] = useState<BotLevel | null>(null);
  const [color, setColor] = useState<Color>('w');

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', gap: 28,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🤖</div>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 6 }}>Choose Your Opponent</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
          All bots trash-talk. The stronger the bot, the more embarrassing your defeat.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        width: '100%',
        maxWidth: 860,
      }}>
        {LEVELS.map(level => {
          const info = DIFFICULTY_INFO[level];
          const isSelected = selected === level;
          return (
            <button
              key={level}
              onClick={() => setSelected(level)}
              style={{
                background: isSelected ? `${info.color}22` : 'var(--surface)',
                border: `2px solid ${isSelected ? info.color : 'var(--surface3)'}`,
                borderRadius: 12,
                padding: '18px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                color: 'var(--text)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{info.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{info.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{info.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>Play as:</span>
        {(['w', 'b'] as Color[]).map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              background: color === c ? 'var(--accent)' : 'var(--surface2)',
              border: '1px solid var(--surface3)',
              borderRadius: 8,
              padding: '7px 18px',
              cursor: 'pointer',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'background 0.15s',
            }}
          >
            {c === 'w' ? '⬜ White' : '⬛ Black'}
          </button>
        ))}
      </div>

      <button
        disabled={!selected}
        onClick={() => selected && onStart(selected, color)}
        style={{
          background: selected
            ? `linear-gradient(120deg, var(--accent), var(--accent2))`
            : 'var(--surface2)',
          border: 'none',
          borderRadius: 10,
          padding: '12px 36px',
          fontSize: '1rem',
          fontWeight: 700,
          color: selected ? '#fff' : 'var(--text-dim)',
          cursor: selected ? 'pointer' : 'not-allowed',
          transition: 'transform 0.12s',
        }}
      >
        {selected ? `Fight ${DIFFICULTY_INFO[selected].icon} ${DIFFICULTY_INFO[selected].name}` : 'Select a difficulty first'}
      </button>
    </div>
  );
}

function BotGameView({
  level,
  humanColor,
  onMenu,
}: {
  level: BotLevel;
  humanColor: Color;
  onMenu: () => void;
}) {
  const game = useBotGame(level, humanColor);
  const [showConfirm, setShowConfirm] = useState(false);
  const info = DIFFICULTY_INFO[level];

  const statusPanel = (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 10,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: '0.82rem',
      color: 'var(--text-dim)',
    }}>
      <span>{info.icon}</span>
      <span style={{ color: info.color, fontWeight: 600 }}>{info.name}</span>
      {game.turn !== humanColor && (
        <span style={{ color: 'var(--accent2)', marginLeft: 'auto' }}>
          {game.stockfishThinking ? '🦅 Thinking…' : '🤔 Thinking…'}
        </span>
      )}
      {level === 'eagle' && !game.stockfishReady && (
        <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Loading Stockfish…
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="game-layout">
        <Board
          engine={game.engine}
          selectedSquare={game.selectedSquare}
          legalTargets={game.legalTargets}
          lastMove={game.lastMove}
          onSquareClick={game.onSquareClick}
          mode="bot"
          humanColor={humanColor}
          botLabel={`${info.icon} ${info.name}`}
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
          showTimer={game.turn === humanColor}
          extraPanel={statusPanel}
        />
      </div>

      <GameOverModal
        show={game.isGameOver}
        winner={game.winner}
        reason={game.overReason}
        onPlayAgain={game.onReset}
        onMenu={onMenu}
      />

      <PromotionModal
        show={!!game.pendingPromotion}
        color={game.turn}
        onChoose={game.onPromotion}
      />

      <ConfirmModal
        show={showConfirm}
        title="Leave game? 🚪"
        message="The bot will think you lost on time."
        confirmLabel="Flee"
        cancelLabel="Stay"
        onConfirm={onMenu}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

export default function BotPage() {
  const [config, setConfig] = useState<{ level: BotLevel; color: Color } | null>(null);

  if (!config) {
    return <DifficultyPicker onStart={(level, color) => setConfig({ level, color })} />;
  }

  return (
    <BotGameView
      level={config.level}
      humanColor={config.color}
      onMenu={() => setConfig(null)}
    />
  );
}
