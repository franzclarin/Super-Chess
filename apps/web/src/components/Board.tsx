'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import type { ChessEngine, Square } from '@super-chess/chess-core';
import { UNICODE, FILES, RANKS } from '@/lib/constants';
import s from './Board.module.css';

interface BoardProps {
  engine: ChessEngine;
  selectedSquare: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  lastCaptureSq?: Square | null;
  onSquareClick: (sq: Square) => void;
  mode: 'local' | 'online' | 'bot';
  flipped?: boolean;
  animated?: boolean;
  botLabel?: string;
}

const PARTICLE_COLORS = ['#e94560','#f5a623','#ffd700','#ff6b35','#c44dff','#00e5ff'];

export function Board({
  engine,
  selectedSquare,
  legalTargets,
  lastMove,
  lastCaptureSq,
  onSquareClick,
  mode,
  flipped,
  animated,
  botLabel,
}: BoardProps) {
  const squareRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isFlipping, setIsFlipping] = useState(false);
  const prevFlippedRef = useRef<boolean | undefined>(undefined);

  const spawnParticles = useCallback((el: HTMLDivElement) => {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = s.particle;
      const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      const dx = (Math.random() - 0.5) * 80;
      const dy = (Math.random() - 0.5) * 80;
      const dur = 0.4 + Math.random() * 0.35;
      p.style.cssText = `background:${color};left:50%;top:50%;--dx:${dx}px;--dy:${dy}px;animation-duration:${dur}s`;
      el.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }, []);

  const triggerCapture = useCallback((sq: Square) => {
    const el = squareRefs.current.get(sq);
    if (!el) return;
    el.classList.add(s.capFlash);
    spawnParticles(el);
    setTimeout(() => el.classList.remove(s.capFlash), 500);
  }, [spawnParticles]);

  // BUG-006: fire capture animation whenever lastCaptureSq changes to a non-null value
  useEffect(() => {
    if (lastCaptureSq) triggerCapture(lastCaptureSq);
  }, [lastCaptureSq, triggerCapture]);

  // Flip animation: trigger when `flipped` changes (skip initial render)
  useEffect(() => {
    if (!animated) return;
    if (prevFlippedRef.current === undefined) {
      prevFlippedRef.current = !!flipped;
      return;
    }
    if (prevFlippedRef.current === !!flipped) return;
    prevFlippedRef.current = !!flipped;
    setIsFlipping(true);
    const t = setTimeout(() => setIsFlipping(false), 320);
    return () => clearTimeout(t);
  }, [flipped, animated]);

  const turn = engine.turn;
  const inCheckSqs = new Set<string>();
  if (engine.inCheck) {
    // Find the king in check
    for (const rank of '87654321') {
      for (const file of 'abcdefgh') {
        const sq = file + rank;
        const p = engine.get(sq);
        if (p?.type === 'k' && p.color === turn) inCheckSqs.add(sq);
      }
    }
  }

  const legalSet = new Set(legalTargets);

  const modeLabels = { local: 'LOCAL', online: 'ONLINE', bot: `BOT${botLabel ? ` · ${botLabel}` : ''}` };
  const modeClass = { local: s.badgeLocal, online: s.badgeOnline, bot: s.badgeBot };

  const displayRanks = flipped ? [...RANKS].reverse() : [...RANKS];
  const displayFiles = flipped ? [...FILES].reverse() : [...FILES];

  return (
    <div className={s.wrap}>
      <span className={`${s.modeBadge} ${modeClass[mode]}`}>{modeLabels[mode]}</span>
      <div className={`${s.inner}${isFlipping ? ` ${s.flipping}` : ''}`}>
        <div className={s.rankCol}>
          {displayRanks.map(r => (
            <div key={r} className={s.rankLabel}>{r}</div>
          ))}
        </div>
        <div className={s.boardCol}>
          <div className={s.grid}>
            {displayRanks.map((rank, ri) =>
              displayFiles.map((file, fi) => {
                const sq = file + rank;
                const piece = engine.get(sq);
                const isLight = (fi + ri) % 2 === 0;
                const isSelected = selectedSquare === sq;
                const isLegal = legalSet.has(sq) && !piece;
                const isLegalCap = legalSet.has(sq) && !!piece;
                const isLastFrom = lastMove?.from === sq;
                const isLastTo = lastMove?.to === sq;
                const isCheck = inCheckSqs.has(sq);

                const cls = [
                  s.sq,
                  isLight ? s.light : s.dark,
                  isSelected ? s.selected : '',
                  !isSelected && isLastFrom ? s.lastFrom : '',
                  !isSelected && isLastTo ? s.lastTo : '',
                  isCheck ? s.inCheck : '',
                  isLegal ? s.legal : '',
                  isLegalCap ? s.legalCap : '',
                ].filter(Boolean).join(' ');

                const pieceChar = piece
                  ? (UNICODE[piece.color + piece.type.toUpperCase()] ?? '')
                  : null;

                return (
                  <div
                    key={sq}
                    className={cls}
                    data-sq={sq}
                    ref={el => { if (el) squareRefs.current.set(sq, el); }}
                    onClick={() => onSquareClick(sq)}
                  >
                    {pieceChar && (
                      <span className={s.piece}>{pieceChar}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className={s.fileRow}>
            {displayFiles.map(f => (
              <div key={f} className={s.fileLabel}>{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
