'use client';
import type { Color, Piece, ChatMessage } from '@super-chess/chess-core';
import { WHITE_TRASH_TALK, BLACK_TRASH_TALK, pieceChar, PIECE_NAMES } from '@/lib/constants';
import s from './Sidebar.module.css';

interface SidebarProps {
  turn: Color;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  timerSeconds: number;
  capturedByWhite: Piece[];
  capturedByBlack: Piece[];
  moveHistory: string[];
  events: string[];
  chatMessages: ChatMessage[];
  onTrashTalk: (player: Color, text: string) => void;
  showTimer?: boolean;
  extraPanel?: React.ReactNode;
}

function TimerBar({ seconds }: { seconds: number }) {
  const pct = (seconds / 15) * 100;
  const color = pct > 60 ? '#4caf50' : pct > 30 ? '#ff9800' : '#f44336';
  return (
    <div>
      <div className={s.timerWrap}>
        <div
          className={s.timerBar}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className={s.timerLabel}>{seconds}s</div>
    </div>
  );
}

export function Sidebar({
  turn, inCheck, isCheckmate, isStalemate, isDraw,
  timerSeconds, capturedByWhite, capturedByBlack,
  moveHistory, events, chatMessages, onTrashTalk,
  showTimer = true, extraPanel,
}: SidebarProps) {
  let turnText = (turn === 'w' ? 'White' : 'Black') + "'s Turn";
  if (isCheckmate) turnText = (turn === 'w' ? 'Black' : 'White') + ' wins! 👑';
  else if (isStalemate) turnText = 'Stalemate 🤝';
  else if (isDraw) turnText = 'Draw 🫱🫲';
  else if (inCheck) turnText = (turn === 'w' ? 'White' : 'Black') + ' is in check ⚠️';

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={s.sidebar}>
      {/* Turn + Timer */}
      <div className={s.panel}>
        <div className={s.turnRow}>
          <div className={`${s.dot} ${turn === 'w' ? s.dotW : s.dotB}`} />
          <span className={s.turnText}>{turnText}</span>
        </div>
        {showTimer && <TimerBar seconds={timerSeconds} />}
      </div>

      {/* Extra slot (online lobby status, bot status, etc.) */}
      {extraPanel}

      {/* Captured pieces */}
      <div className={s.panel}>
        <h3>Captured Pieces</h3>
        <div className={s.capRow}>
          {capturedByWhite.map((p, i) => (
            <span key={i}>{pieceChar(p.type, p.color)}</span>
          ))}
        </div>
        <div className={s.capSep}>⬆ White captures · Black captures ⬇</div>
        <div className={s.capRow}>
          {capturedByBlack.map((p, i) => (
            <span key={i}>{pieceChar(p.type, p.color)}</span>
          ))}
        </div>
      </div>

      {/* Move history */}
      <div className={s.panel}>
        <h3>Move History</h3>
        <div className={s.histScroll} ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
          {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
            <div key={i} className={s.hRow}>
              <span className={s.hNum}>{i + 1}.</span>
              <span className={s.hW}>{moveHistory[i * 2] ?? ''}</span>
              <span className={s.hB}>{moveHistory[i * 2 + 1] ?? ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chaos log */}
      <div className={s.panel}>
        <h3>🌀 Chaos Log</h3>
        <div className={s.elog} ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
          {events.map((e, i) => (
            <div key={i} className={s.elogItem}>{e}</div>
          ))}
        </div>
      </div>

      {/* Trash talk */}
      <div className={s.panel}>
        <h3>💬 Trash Talk</h3>
        <div className={s.chatLog} ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
          {chatMessages.map((m, i) => (
            <div key={i} className={`${s.chatMsg} ${m.player === 'w' ? s.chatMsgW : s.chatMsgB}`}>
              <div className={s.chatHeader}>
                <span className={s.chatSender}>{m.player === 'w' ? '⬜ White' : '⬛ Black'}</span>
                <span className={s.chatTime}>{fmt(m.timestamp)}</span>
              </div>
              <div className={s.chatText}>{m.text}</div>
            </div>
          ))}
        </div>
        <div className={s.chatBtns}>
          <div className={s.cbSection}>
            <div className={s.cbLabel}>⬜ White says:</div>
            <div className={s.cbRow}>
              {WHITE_TRASH_TALK.map(({ e, t }) => (
                <button key={t} className={s.cb} title={t} onClick={() => onTrashTalk('w', t)}>
                  {e} {t.slice(0, 20)}{t.length > 20 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className={s.cbSection}>
            <div className={s.cbLabel}>⬛ Black says:</div>
            <div className={s.cbRow}>
              {BLACK_TRASH_TALK.map(({ e, t }) => (
                <button key={t} className={s.cb} title={t} onClick={() => onTrashTalk('b', t)}>
                  {e} {t.slice(0, 20)}{t.length > 20 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
