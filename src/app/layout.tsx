import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B-Vault: Platform Lisensi Google AI & Aplikasi Pro (@barajapu_)',
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
      </head>
      <body>
        <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                B
              </div>
              <div>
                <strong style={{ fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1 }}>B-Vault</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>@barajapu_ Official Store</span>
              </div>
            </Link>

            <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link href="/" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.88rem' }}>
                Katalog
              </Link>
              <Link href="/vault" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.88rem' }}>
                B-Vault Lisensi
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 140px)', padding: '24px 0 48px' }}>
          {children}
        </main>

        <footer style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', padding: '24px 0' }}>
          <div className="container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <strong>B-Vault</strong> (@barajapu_). Marketplace lisensi & akun pro on-demand: Aman, Resmi, Privat, Terpercaya.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Order & Konfirmasi CS WhatsApp: <strong>0851 8341 0190</strong>. Pembayaran otomatis QRIS & VA Multi-Bank.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.84rem' }}>
              <Link href="/" style={{ color: 'var(--text-secondary)' }}>Katalog Produk</Link>
              <Link href="/vault" style={{ color: 'var(--text-secondary)' }}>Cek Lisensi Saya</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
