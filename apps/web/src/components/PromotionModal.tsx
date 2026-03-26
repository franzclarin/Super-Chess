'use client';
import type { Color } from '@super-chess/chess-core';
import { UNICODE } from '@/lib/constants';
import styles from './Modal.module.css';

interface Props {
  show: boolean;
  color: Color;
  onChoose: (piece: string) => void;
}

export function PromotionModal({ show, color, onChoose }: Props) {
  if (!show) return null;

  const pieces: Array<{ type: string; char: string }> = [
    { type: 'q', char: UNICODE[color + 'Q'] },
    { type: 'r', char: UNICODE[color + 'R'] },
    { type: 'b', char: UNICODE[color + 'B'] },
    { type: 'n', char: UNICODE[color + 'N'] },
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Promotion!</h2>
        <p className={styles.msg}>Your pawn survived the gauntlet. Choose your reward:</p>
        <div className={styles.promoChoices}>
          {pieces.map(({ type, char }) => (
            <button key={type} className={styles.promoBtn} onClick={() => onChoose(type)}>
              {char}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
