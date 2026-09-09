'use client';

import React, { useState } from 'react';

interface GoogleAuthButtonProps {
  redirectPath?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  onSuccess?: (user: any) => void;
}

export default function GoogleAuthButton({
  redirectPath = '/',
  className = 'btn btn-secondary',
  style = {},
  label = 'Masuk dengan Google',
  onSuccess,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [simName, setSimName] = useState('');
  const [simError, setSimError] = useState('');

  async function handleGoogleClick() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/auth/google/url?redirect=${encodeURIComponent(redirectPath)}`);
      const data = await res.json();

      if (data.success && data.data?.isConfigured && data.data?.authUrl) {
        // Direct redirect to real Google OAuth
        window.location.href = data.data.authUrl;
      } else {
        // Google OAuth is not configured in .env.local yet -> Open quick test / config modal
        setShowConfigModal(true);
      }
    } catch {
      setShowConfigModal(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulatedSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!simEmail) return;

    try {
      setLoading(true);
      setSimError('');
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: simEmail, name: simName }),
      });
      const data = await res.json();
      if (data.success) {
        setShowConfigModal(false);
        if (onSuccess) {
          onSuccess(data.data.user);
        } else {
          window.location.reload();
        }
      } else {
        setSimError(data.error?.message || 'Gagal login simulasi Google');
      }
    } catch {
      setSimError('Koneksi ke server gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          ...style,
        }}
        onClick={handleGoogleClick}
        disabled={loading}
      >
        {/* Official Google G Logo */}
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{loading ? 'Menghubungkan...' : label}</span>
      </button>

      {/* Modal Setup Google OAuth / Quick Sim */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--hairline)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                <strong style={{ color: 'var(--gold-light)', fontSize: '1.05rem' }}>
                  GOOGLE LOGIN
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}
              >
                &times;
              </button>
            </div>

            <div style={{ backgroundColor: 'rgba(219, 177, 99, 0.06)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-xs)', padding: '12px', marginBottom: '18px', fontSize: '0.84rem', color: 'var(--body)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--gold-light)', display: 'block', marginBottom: '4px' }}>
                Mode Google Sign-In B-Vault
              </strong>
              Integrasi OAuth resmi siap aktif seketika setelah kredensial Google Cloud diisi di file <code>.env.local</code>.
              Untuk pengujian lokal, Anda dapat langsung masuk dengan email Google pengujian di bawah ini:
            </div>

            {simError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius-xs)', marginBottom: '14px', fontSize: '0.84rem' }}>
                {simError}
              </div>
            )}

            <form onSubmit={handleSimulatedSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>
                  Alamat Email Google (Gmail)
                </label>
                <input
                  type="email"
                  required
                  placeholder="contoh: nama.pembeli@gmail.com"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>
                  Nama Lengkap (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfigModal(false)}
                  style={{ flex: 1, fontSize: '0.86rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ flex: 2, fontSize: '0.86rem', fontWeight: 700 }}
                >
                  {loading ? 'Masuk...' : 'Masuk Sekarang ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
