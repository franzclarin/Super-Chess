import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '🐾 Super Chess — Chaos Edition',
  description: 'Chess, but the pieces have opinions. Three modes: local, online, and bot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'var(--surface)',
          borderBottom: '2px solid var(--accent)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <h1 style={{
              fontSize: '1.6rem',
              background: 'linear-gradient(120deg, #e94560, #f5a623, #7c4dff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              whiteSpace: 'nowrap',
            }}>
              🐾 Super Chess
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 1 }}>
              chess, but the pieces have opinions
            </p>
          </div>
          <a
            href="/"
            style={{
              color: 'var(--text-dim)',
              fontSize: '0.8rem',
              border: '1px solid var(--surface3)',
              padding: '5px 12px',
              borderRadius: 6,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            ← Menu
          </a>
        </header>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
