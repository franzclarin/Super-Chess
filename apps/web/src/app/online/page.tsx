'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineGame } from '@/hooks/useOnlineGame';
import { Board } from '@/components/Board';
import { Sidebar } from '@/components/Sidebar';
import { GameOverModal } from '@/components/GameOverModal';
import { PromotionModal } from '@/components/PromotionModal';
import { ConfirmModal } from '@/components/ConfirmModal';

function ConnectionBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    connecting: { color: '#ff9800', label: '⏳ Connecting…' },
    connected:  { color: '#4caf50', label: '🟢 Connected' },
    disconnected: { color: '#f44336', label: '🔴 Disconnected' },
    error:      { color: '#f44336', label: '❌ Connection failed' },
  };
  const info = map[status] ?? map.connecting;
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 600,
      color: info.color, padding: '3px 10px',
      background: `${info.color}22`, borderRadius: 20,
      border: `1px solid ${info.color}66`,
    }}>
      {info.label}
    </span>
  );
}

function Lobby({ game }: { game: ReturnType<typeof useOnlineGame> }) {
  const [playerName, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  const nameInput = (
    <input
      value={playerName}
      onChange={e => setName(e.target.value)}
      placeholder="Your name (optional)"
      maxLength={20}
      style={{
        background: 'var(--surface2)', border: '1px solid var(--surface3)',
        borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
        fontSize: '0.9rem', width: '100%', marginBottom: 12,
        outline: 'none',
      }}
    />
  );

  const btnStyle = (active: boolean) => ({
    background: active ? 'var(--accent)' : 'var(--surface2)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--surface3)'}`,
    borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
    color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem',
    transition: 'background 0.15s',
  });

  const ctaStyle = {
    background: 'linear-gradient(120deg, var(--accent), var(--accent2))',
    border: 'none', borderRadius: 9, padding: '11px 0',
    color: '#fff', fontWeight: 700, fontSize: '0.95rem',
    cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
  } as const;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', gap: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌐</div>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 6 }}>Online Play</h2>
        <ConnectionBadge status={game.connectionStatus} />
        {game.connectionStatus === 'error' && (
          <p style={{ color: '#f44336', fontSize: '0.8rem', marginTop: 8 }}>
            Could not reach the server. Is{' '}
            <code>{process.env.NEXT_PUBLIC_SOCKET_URL ?? 'localhost:3001'}</code>{' '}
            running?
          </p>
        )}
      </div>

      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        padding: '24px 22px', width: '100%', maxWidth: 380,
        border: '1px solid var(--surface3)',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={btnStyle(tab === 'create')} onClick={() => setTab('create')}>
            Create Game
          </button>
          <button style={btnStyle(tab === 'join')} onClick={() => setTab('join')}>
            Join Game
          </button>
        </div>

        {tab === 'create' && (
          <>
            {nameInput}
            <button
              style={ctaStyle}
              disabled={game.connectionStatus !== 'connected'}
              onClick={() => game.createRoom(playerName)}
            >
              Create Room →
            </button>
            {game.lobbyStatus === 'waiting' && game.roomCode && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: 8 }}>
                  Share this code with your friend:
                </p>
                <div style={{
                  fontSize: '2rem', fontWeight: 800, letterSpacing: '0.12em',
                  color: 'var(--accent2)', background: 'var(--surface2)',
                  borderRadius: 10, padding: '12px 20px', cursor: 'pointer',
                }}
                  onClick={() => navigator.clipboard.writeText(game.roomCode ?? '')}
                  title="Click to copy"
                >
                  {game.roomCode}
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 6 }}>
                  ⏳ Waiting for opponent… (click code to copy)
                </p>
              </div>
            )}
          </>
        )}

        {tab === 'join' && (
          <>
            {nameInput}
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code (e.g. WOLF-42)"
              maxLength={10}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--surface3)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
                fontSize: '0.9rem', width: '100%', marginBottom: 12,
                outline: 'none', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}
            />
            <button
              style={ctaStyle}
              disabled={game.connectionStatus !== 'connected' || !joinCode.includes('-')}
              onClick={() => game.joinRoom(joinCode, playerName)}
            >
              Join Room →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnlinePage() {
  const game = useOnlineGame();
  const [showConfirm, setShowConfirm] = useState(false);

  if (game.lobbyStatus !== 'active') {
    return <Lobby game={game} />;
  }

  const colorLabel = game.playerColor === 'w' ? '⬜ White' : '⬛ Black';
  const opponentLabel = `${game.playerColor === 'w' ? '⬛ Black' : '⬜ White'} · ${game.opponentName}`;

  const statusPanel = (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 10, padding: '8px 12px',
      fontSize: '0.8rem',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)' }}>You: <strong style={{ color: 'var(--text)' }}>{colorLabel}</strong></span>
        <span style={{ color: 'var(--text-dim)' }}>Room: <strong style={{ color: 'var(--accent2)' }}>{game.roomCode}</strong></span>
      </div>
      <div style={{ color: 'var(--text-dim)' }}>
        Opponent: <strong style={{ color: 'var(--text)' }}>{opponentLabel}</strong>
        {game.opponentDisconnected && <span style={{ color: '#f44336', marginLeft: 6 }}>⚠️ disconnected</span>}
      </div>
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
          mode="online"
          humanColor={game.playerColor ?? 'w'}
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
          extraPanel={statusPanel}
        />
      </div>

      <GameOverModal
        show={game.isGameOver}
        winner={game.winner}
        reason={game.overReason}
        onPlayAgain={game.onReset}
        onMenu={() => setShowConfirm(true)}
        onRematch={game.onRematchOffer}
        rematchOffered={game.rematchOffered}
      />

      <PromotionModal
        show={!!game.pendingPromotion}
        color={game.turn}
        onChoose={game.onPromotion}
      />

      <ConfirmModal
        show={showConfirm}
        title="Leave game? 🚪"
        message="Your opponent will be notified you forfeited. The pieces will mourn."
        confirmLabel="Forfeit & Leave"
        cancelLabel="Stay"
        onConfirm={() => { game.onReset(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
