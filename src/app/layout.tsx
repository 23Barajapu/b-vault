import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B-Vault: Platform Lisensi Google AI & Aplikasi Pro',
  description: 'B-Vault penyedia resmi Google AI Pro (18 Bulan), CapCut Pro, Canva Pro, Canva Pro Bisnis, Claude Pro, dan Claude Max.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Sticky Header with Exact Charcoal #191814 & Gold #dbb163 */}
        <header style={{
          backgroundColor: 'rgba(25, 24, 20, 0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--hairline)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.7)'
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'var(--ink)' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1.5px solid var(--accent-gold)',
                boxShadow: '0 0 16px rgba(219, 177, 99, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#191814'
              }}>
                <img
                  src="/logo.png"
                  alt="B-Vault Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div>
                <strong className="font-display" style={{ fontSize: '1.25rem', display: 'block', lineHeight: 1.1, color: '#fcfcfc', letterSpacing: '0.06em' }}>
                  B-VAULT
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)', display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Digital License Vault
                </span>
              </div>
            </Link>

            <div style={{ display: 'none', alignItems: 'center', gap: '8px' }} className="status-live-desktop">
              <span className="live-pulse-dot" />
              <span style={{ fontSize: '0.78rem', color: 'var(--body)', letterSpacing: '0.02em' }}>
                OTOMASI AKTIF &bull; SLA &lt; 15 MENIT
              </span>
            </div>

            <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link href="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Katalog
              </Link>
              <Link href="/vault" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Cek Lisensi
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 140px)', padding: '24px 0 48px' }}>
          {children}
        </main>

        {/* Footer with Exact Charcoal #191814, Velvet Red #640509 & Gold Cross Divider #dbb163 */}
        <footer style={{
          backgroundColor: '#191814',
          borderTop: '1px solid var(--hairline)',
          padding: '36px 0 28px',
          position: 'relative'
        }}>
          {/* Visual Gold Cross Accent Divider with ✦ symbol */}
          <div className="gold-cross-divider" style={{ marginTop: '-48px', marginBottom: '32px' }}>
            <div className="gold-cross-badge">✦</div>
          </div>

          <div className="container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '0.92rem', color: 'var(--body)', marginBottom: '4px' }}>
                <strong className="font-display" style={{ color: 'var(--gold-light)', fontSize: '1.05rem', letterSpacing: '0.04em' }}>B-VAULT</strong> &bull; Official Pro License & Digital Suite Provider.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                CS WhatsApp: <strong style={{ color: 'var(--ink)' }}>0851 8341 0190</strong> &bull; Verifikasi instan QRIS & Virtual Account 24 Jam.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
              <Link href="/" style={{ color: 'var(--accent-gold)' }}>Katalog Lisensi</Link>
              <Link href="/vault" style={{ color: 'var(--accent-gold)' }}>Customer Vault</Link>
              <Link href="/ops" style={{ color: 'var(--muted)' }}>Ops Desk</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
