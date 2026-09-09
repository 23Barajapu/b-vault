'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import GoogleAuthButton from './GoogleAuthButton';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSession();

    // Close dropdown on outside click
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchSession() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/auth/session');
      const data = await res.json();
      if (data.success && data.data?.authenticated) {
        setUser(data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      sessionStorage.removeItem('bv_ops_token');
      setUser(null);
      setDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Logout error', err);
    }
  }

  if (loading) {
    return (
      <div style={{ width: '90px', height: '36px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--surface-card)', opacity: 0.5 }} />
    );
  }

  if (!user) {
    return (
      <GoogleAuthButton
        redirectPath="/"
        className="btn btn-secondary"
        style={{ padding: '8px 14px', fontSize: '0.84rem' }}
        label="Masuk Google"
        onSuccess={(newUser) => setUser(newUser)}
      />
    );
  }

  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        className="user-nav-btn"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="Menu profil akun pengguna"
        title={user.name}
      >
        {/* Profile Avatar Icon */}
        {user.avatar_url && !imgError ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="user-nav-avatar"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="user-nav-avatar-fallback">
            {initial}
          </div>
        )}

        {/* Name and Role (auto-hidden on mobile to keep profile icon clean) */}
        <div className="user-nav-details">
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name.split(' ')[0]}
          </span>
          <span style={{ fontSize: '0.66rem', color: user.role === 'admin' ? 'var(--gold-light)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {user.role === 'admin' ? 'Admin Ops' : 'Member'}
          </span>
        </div>

        <span className="user-nav-arrow" style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '2px' }}>▼</span>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '220px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--accent-gold)',
            borderRadius: 'var(--radius-xs)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* Header Info */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hairline)', backgroundColor: 'var(--surface-elevated)' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--gold-light)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {user.name}
            </strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {user.email}
            </span>
          </div>

          {/* Links */}
          <div style={{ padding: '6px 0' }}>
            <Link
              href="/vault"
              onClick={() => setDropdownOpen(false)}
              style={{
                display: 'block',
                padding: '8px 14px',
                fontSize: '0.84rem',
                color: 'var(--ink)',
                textDecoration: 'none',
              }}
              className="dropdown-hover"
            >
              🔑 Vault Lisensi Saya
            </Link>

            {user.role === 'admin' && (
              <Link
                href="/ops"
                onClick={() => setDropdownOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 14px',
                  fontSize: '0.84rem',
                  color: 'var(--gold-light)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
                className="dropdown-hover"
              >
                ⚙️ Panel Admin / Ops Desk
              </Link>
            )}

            <div style={{ height: '1px', backgroundColor: 'var(--hairline)', margin: '4px 0' }} />

            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 14px',
                fontSize: '0.84rem',
                color: 'var(--danger)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                minHeight: 'auto',
                minWidth: 'auto',
              }}
            >
              🚪 Keluar (Logout)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
