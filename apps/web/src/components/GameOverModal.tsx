'use client';
import type { Color } from '@super-chess/chess-core';
import styles from './Modal.module.css';

interface Props {
  show: boolean;
  winner: Color | null;
  reason: string | null;
  onPlayAgain: () => void;
  onMenu: () => void;
  onRematch?: () => void;
  rematchOffered?: boolean;
}

export function GameOverModal({ show, winner, reason, onPlayAgain, onMenu, onRematch, rematchOffered }: Props) {
  if (!show) return null;

  let title = 'Game Over';
  let msg = 'The chaos has concluded.';

  if (reason === 'checkmate') {
    title = `${winner === 'w' ? 'White' : 'Black'} wins! 👑`;
    msg = `Checkmate! ${winner === 'w' ? 'White' : 'Black'} obliterated the opposition.`;
  } else if (reason === 'stalemate') {
    title = 'Stalemate! 🤝';
    msg = 'Nobody wins. The pieces chose peace.';
  } else if (reason === 'draw') {
    title = 'Draw! 🫱🫲';
    msg = 'Very diplomatic. Nobody loses either.';
  } else if (reason === 'resign') {
    title = `${winner === 'w' ? 'White' : 'Black'} wins! 🏳️`;
    msg = 'Opponent resigned. Victory by forfeit.';
  } else if (reason === 'abandonment') {
    title = 'Opponent left 👋';
    msg = 'They disconnected and never came back.';
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.msg}>{msg}</p>
        <div className={styles.btnRow}>
          <button className={styles.btnPrimary} onClick={onPlayAgain}>
            Play Again 🎮
          </button>
          {onRematch && (
            <button
              className={styles.btnSecondary}
              onClick={onRematch}
              disabled={rematchOffered}
            >
              {rematchOffered ? 'Rematch Offered ✋' : 'Offer Rematch 🔄'}
            </button>
          )}
          <button className={styles.btnGhost} onClick={onMenu}>
            ← Menu
          </button>
        </div>
      </div>
    </div>
  );
}
