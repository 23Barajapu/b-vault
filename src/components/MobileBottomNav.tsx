'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on admin/ops desk to avoid cluttering operational workspace
  if (pathname.startsWith('/ops') || pathname.startsWith('/admin')) {
    return null;
  }

  const isKatalogActive = pathname === '/';
  const isVaultActive = pathname === '/vault';

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Navigasi Utama Mobile"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(25, 24, 20, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--hairline)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.75)',
        zIndex: 99,
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingTop: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          maxWidth: '540px',
          margin: '0 auto',
        }}
      >
        {/* Tab 1: Katalog */}
        <Link
          href="/"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '72px',
            minHeight: '48px',
            textDecoration: 'none',
            color: isKatalogActive ? 'var(--gold-light)' : 'var(--muted)',
            gap: '3px',
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🛍️</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: isKatalogActive ? 700 : 500,
              letterSpacing: '0.02em',
            }}
          >
            Katalog
          </span>
        </Link>

        {/* Tab 2: Cek Lisensi */}
        <Link
          href="/vault"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '72px',
            minHeight: '48px',
            textDecoration: 'none',
            color: isVaultActive ? 'var(--gold-light)' : 'var(--muted)',
            gap: '3px',
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🔑</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: isVaultActive ? 700 : 500,
              letterSpacing: '0.02em',
            }}
          >
            Cek Lisensi
          </span>
        </Link>

        {/* Tab 3: Bantuan CS WhatsApp */}
        <a
          href="https://wa.me/6285183410190?text=Halo%20CS%20B-Vault,%20saya%20butuh%20bantuan"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '72px',
            minHeight: '48px',
            textDecoration: 'none',
            color: 'var(--muted)',
            gap: '3px',
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>💬</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Bantuan CS
          </span>
        </a>
      </div>
    </nav>
  );
}
