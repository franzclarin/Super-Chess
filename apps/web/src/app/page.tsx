import Link from 'next/link';

const MODES = [
  {
    href: '/local',
    icon: '🐾',
    title: 'Local Play',
    badge: 'LOCAL',
    badgeColor: '#f5a623',
    desc: 'Two players, one screen. Full chaos mode active. Pieces will revolt if you AFK.',
    bullets: ['Boredom timer · Drift mechanic', 'Sounds: meow, bark, chirp, explosion', 'Full trash talk panel'],
    cta: 'Play Local',
    glow: 'rgba(245,166,35,0.15)',
    border: 'rgba(245,166,35,0.4)',
  },
  {
    href: '/online',
    icon: '🌐',
    title: 'Online Play',
    badge: 'ONLINE',
    badgeColor: '#4caf50',
    desc: 'Create a room, share the code. Play against a friend anywhere in the world.',
    bullets: ['Shareable room codes', 'Server-authoritative chaos events', 'Reconnect within 30s if you drop'],
    cta: 'Play Online',
    glow: 'rgba(76,175,80,0.15)',
    border: 'rgba(76,175,80,0.4)',
  },
  {
    href: '/bot',
    icon: '🤖',
    title: 'Play vs Bot',
    badge: 'BOT',
    badgeColor: '#7c4dff',
    desc: 'Four difficulties: from chaotic kitten to Stockfish eagle. The bot trash talks.',
    bullets: ['🐱 Kitten · 🐶 Puppy · 🦊 Fox · 🦅 Eagle', 'Bot auto-trash-talks (40% per move)', 'Eagle = Stockfish WASM, depth 15'],
    cta: 'Play vs Bot',
    glow: 'rgba(124,77,255,0.15)',
    border: 'rgba(124,77,255,0.4)',
  },
] as const;

export default function Home() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>♟️</div>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text)', marginBottom: 6 }}>
          Choose your chaos mode
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: 440 }}>
          All three modes share the same board, sounds, and chaos engine.
          Pieces will always have opinions about your moves.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        width: '100%',
        maxWidth: 920,
      }}>
        {MODES.map(m => (
          <div
            key={m.href}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${m.border}`,
              borderRadius: 16,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: `0 0 30px ${m.glow}`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '2rem' }}>{m.icon}</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 2 }}>{m.title}</h3>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: m.badgeColor, background: `${m.badgeColor}22`,
                  padding: '2px 8px', borderRadius: 20,
                  border: `1px solid ${m.badgeColor}66`,
                }}>{m.badge}</span>
              </div>
            </div>

            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              {m.desc}
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {m.bullets.map(b => (
                <li key={b} style={{ color: 'var(--text-dim)', fontSize: '0.78rem', paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: m.badgeColor }}>›</span>
                  {b}
                </li>
              ))}
            </ul>

            <Link
              href={m.href}
              style={{
                marginTop: 'auto',
                display: 'block',
                background: `linear-gradient(120deg, ${m.badgeColor}, ${m.border})`,
                color: '#fff',
                padding: '11px 0',
                borderRadius: 9,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.92rem',
                transition: 'opacity 0.15s, transform 0.12s',
              }}
            >
              {m.cta} →
            </Link>
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', textAlign: 'center' }}>
        The existing single-file build is preserved at <code style={{ color: 'var(--accent2)' }}>index.html</code> in the repo root.
      </p>
    </div>
  );
}
