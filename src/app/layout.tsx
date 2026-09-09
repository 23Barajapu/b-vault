import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B-Vault: Platform Lisensi Google AI & Aplikasi Pro',
  description: 'B-Vault penyedia resmi Google AI Pro (18 Bulan), CapCut Pro, Canva Pro, Canva Pro Bisnis, Claude Pro, dan Claude Max.',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Sticky Header with Charcoal & Gold Sheen */}
        <header style={{
          backgroundColor: 'rgba(12, 12, 16, 0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--gold-border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)'
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7f0d15 0%, #a81720 100%)',
                border: '1.5px solid var(--gold)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.15rem',
                boxShadow: '0 0 12px rgba(212, 175, 55, 0.35)',
                fontFamily: 'Cinzel, serif'
              }}>
                B
              </div>
              <div>
                <strong className="font-display" style={{ fontSize: '1.2rem', display: 'block', lineHeight: 1.1, color: '#fcfcfc' }}>
                  B-Vault
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)', display: 'block', letterSpacing: '0.04em' }}>
                  Official Store
                </span>
              </div>
            </Link>

            <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link href="/" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.86rem' }}>
                Katalog
              </Link>
              <Link href="/vault" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.86rem' }}>
                B-Vault Lisensi
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 140px)', padding: '24px 0 48px' }}>
          {children}
        </main>

        {/* Footer with Signature Charcoal + Red + Gold Cross Divider */}
        <footer style={{
          backgroundColor: '#0c0c0e',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '36px 0 28px',
          position: 'relative'
        }}>
          {/* Visual Gold Cross Accent Divider */}
          <div className="gold-cross-divider" style={{ marginTop: '-48px', marginBottom: '32px' }}>
            <div className="gold-cross-badge">+</div>
          </div>

          <div className="container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <strong className="font-display" style={{ color: 'var(--gold-light)', fontSize: '1.05rem' }}>B-VAULT</strong> &bull; Exclusive Digital License & Pro Suite Provider.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                CS WhatsApp: <strong style={{ color: 'var(--text-primary)' }}>0851 8341 0190</strong> &bull; Verifikasi instan QRIS & Virtual Account 24 Jam.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
              <Link href="/" style={{ color: 'var(--gold)' }}>Katalog Produk</Link>
              <Link href="/vault" style={{ color: 'var(--gold)' }}>Cek Lisensi Saya</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
