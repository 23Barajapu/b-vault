'use client';

import { useState } from 'react';

interface VaultItem {
  order_number: string;
  secure_token: string;
  target_account: string | null;
  fulfilled_at: string;
  items: Array<{
    product_title: string;
    platform_name: string;
    variant_name: string;
    activation_payload: string;
    admin_delivery_notes: string | null;
    activation_guide: string;
    warranty_expired_at: string | null;
    warranty_days_left: number;
  }>;
}

export default function VaultPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/store/vault?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      if (json.success) {
        setVaultItems(json.data.vault_items);
      } else {
        setVaultItems([]);
      }
      setSearched(true);
    } catch {
      setVaultItems([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="container" style={{ maxWidth: '840px', padding: '16px 16px 48px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(219, 177, 99, 0.08)', border: '1px solid var(--hairline)' }}>
          <span style={{ color: 'var(--accent-gold)', fontSize: '0.78rem' }}>✦</span>
          <span className="font-label-uppercase" style={{ color: 'var(--gold-light)', fontSize: '0.72rem' }}>
            CUSTOMER LICENSE VAULT
          </span>
        </div>
        <h1 className="font-display-md" style={{ color: 'var(--ink)', marginBottom: '8px' }}>
          ARSIP LISENSI & KREDENSIAL
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--body)', maxWidth: '560px', margin: '0 auto' }}>
          Akses riwayat seluruh lisensi aktif, kode aktivasi privat, serta sisa durasi garansi Anda dengan memasukkan email transaksi.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card" style={{ marginBottom: '28px', padding: '20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="vault-email" style={{ display: 'none' }}>Email Transaksi</label>
            <input
              id="vault-email"
              type="email"
              required
              placeholder="Masukkan email transaksi Anda (contoh: nama@email.com)..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--hairline)' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ padding: '0 24px', fontWeight: 700 }}
          >
            {loading ? 'Memeriksa Vault...' : 'CARI LISENSI ➔'}
          </button>
        </form>
      </div>

      {/* Result list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
          <span className="live-pulse-dot" style={{ marginRight: '8px' }} />
          <span>Membuka arsip lisensi aman Anda...</span>
        </div>
      ) : searched && vaultItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2 className="font-title-lg" style={{ color: 'var(--gold-light)', marginBottom: '8px' }}>
            Belum Ada Lisensi Terdaftar
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--body)', maxWidth: '480px', margin: '0 auto' }}>
            Tidak ditemukan lisensi lunas untuk email: <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Pastikan email persis sama dengan saat melakukan pemesanan.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {vaultItems.map((order) => (
            <div key={order.order_number} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--hairline)', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faktur Transaksi</span>
                  <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold-light)' }}>{order.order_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tanggal Terbit</span>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--body)' }}>
                    {new Date(order.fulfilled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {order.target_account && (
                <div style={{ fontSize: '0.86rem', color: 'var(--body)', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                  Target Akun Pemesan: <strong style={{ color: 'var(--gold-light)' }}>{order.target_account}</strong>
                </div>
              )}

              {order.items.map((it, idx) => {
                const itemKey = `${order.order_number}-${idx}`;
                return (
                  <div key={idx} style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', padding: '16px', border: '1px solid var(--hairline)', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span className="badge badge-online" style={{ marginRight: '8px', fontSize: '0.72rem' }}>{it.platform_name}</span>
                        <strong className="font-title-lg" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>{it.product_title}</strong>
                        <div style={{ fontSize: '0.82rem', color: 'var(--gold-light)', marginTop: '2px' }}>{it.variant_name}</div>
                      </div>

                      {it.warranty_days_left > 0 ? (
                        <span className="badge badge-online" style={{ fontSize: '0.75rem' }}>
                          ✦ Garansi Aktif ({it.warranty_days_left} Hari Lagi)
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Garansi Berakhir</span>
                      )}
                    </div>

                    {/* Activation Payload with Luxury Dark Box */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Kredensial / Tautan Lisensi Privat:
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 12px', fontSize: '0.78rem', minHeight: '32px' }}
                          onClick={() => copyText(itemKey, it.activation_payload)}
                        >
                          {copiedIndex === itemKey ? '✓ Tersalin' : 'Salin Kredensial'}
                        </button>
                      </div>
                      <div style={{
                        backgroundColor: 'var(--canvas)',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--hairline)',
                        fontFamily: 'monospace',
                        fontSize: '0.88rem',
                        color: 'var(--gold-light)',
                        wordBreak: 'break-all'
                      }}>
                        {it.activation_payload}
                      </div>
                    </div>

                    {it.admin_delivery_notes && (
                      <div style={{ fontSize: '0.84rem', color: 'var(--body)', marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--gold-light)' }}>Catatan Tim B-Vault:</strong> {it.admin_delivery_notes}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Petunjuk Aktivasi:
                      </span>
                      <p style={{ fontSize: '0.84rem', whiteSpace: 'pre-line', margin: 0, color: 'var(--body)', lineHeight: 1.5 }}>
                        {it.activation_guide}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
