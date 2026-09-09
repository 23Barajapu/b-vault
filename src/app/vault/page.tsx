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
    <div className="container" style={{ maxWidth: '820px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>
          B-Vault: Customer License Vault
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          Akses arsip seluruh lisensi dan akun pro yang pernah Anda beli dengan memasukkan email transaksi Anda.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="vault-email" style={{ display: 'none' }}>Email Transaksi</label>
            <input
              id="vault-email"
              type="email"
              required
              placeholder="Masukkan email transaksi Anda..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ padding: '0 24px' }}
          >
            {loading ? 'Mencari...' : 'Cari Lisensi'}
          </button>
        </form>
      </div>

      {/* Result list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <p>Memuat data lisensi Anda...</p>
        </div>
      ) : searched && vaultItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
            Belum Ada Lisensi Ditemukan
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Tidak ditemukan lisensi lunas untuk email: <strong>{email}</strong>. Pastikan email sama dengan saat checkout.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {vaultItems.map((order) => (
            <div key={order.order_number} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Faktur Transaksi</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{order.order_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tanggal Diserahkan</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {new Date(order.fulfilled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {order.target_account && (
                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Target Akun: <strong>{order.target_account}</strong>
                </div>
              )}

              {order.items.map((it, idx) => {
                const itemKey = `${order.order_number}-${idx}`;
                return (
                  <div key={idx} style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{it.platform_name}</span>
                        <strong style={{ fontSize: '1rem' }}>{it.product_title}</strong>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{it.variant_name}</div>
                      </div>

                      {it.warranty_days_left > 0 ? (
                        <span className="badge badge-online">
                          Garansi Aktif ({it.warranty_days_left} Hari Lagi)
                        </span>
                      ) : (
                        <span className="badge badge-neutral">Garansi Berakhir</span>
                      )}
                    </div>

                    {/* Activation Payload */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Kredensial / Tautan Lisensi:
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', minHeight: '32px' }}
                          onClick={() => copyText(itemKey, it.activation_payload)}
                        >
                          {copiedIndex === itemKey ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                      <div style={{
                        backgroundColor: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        wordBreak: 'break-all'
                      }}>
                        {it.activation_payload}
                      </div>
                    </div>

                    {it.admin_delivery_notes && (
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <strong>Catatan Admin:</strong> {it.admin_delivery_notes}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Petunjuk Aktivasi:
                      </span>
                      <p style={{ fontSize: '0.85rem', whiteSpace: 'pre-line', margin: 0, color: 'var(--text-secondary)' }}>
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
