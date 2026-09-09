'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface OrderItemPayload {
  product_title: string;
  platform_name: string;
  variant_name: string;
  activation_payload: string | null;
  admin_delivery_notes: string | null;
  activation_guide: string | null;
  warranty_expired_at: string | null;
  warranty_days_left: number;
}

interface VaultItem {
  order_number: string;
  secure_token: string;
  target_account: string | null;
  payment_status: 'PENDING_PAYMENT' | 'PAID_PROCESSING' | 'FULFILLED' | 'EXPIRED' | 'REFUNDED';
  total_amount: number;
  payment_method: string;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  expired_at: string | null;
  items: OrderItemPayload[];
}

type VaultFilter = 'ALL' | 'FULFILLED' | 'UNPAID';

export default function VaultPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [filter, setFilter] = useState<VaultFilter>('ALL');

  const searchVault = useCallback(async (targetEmail: string) => {
    if (!targetEmail) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/store/vault?email=${encodeURIComponent(targetEmail.trim())}`);
      const json = await res.json();
      if (json.success) {
        setVaultItems(json.data.vault_items || []);
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
  }, []);

  // Auto-fill and search if user already has an active session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/v1/auth/session');
        const data = await res.json();
        if (data.success && data.data?.authenticated && data.data.user?.email) {
          setEmail(data.data.user.email);
          searchVault(data.data.user.email);
        }
      } catch {}
    }
    checkSession();
  }, [searchVault]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    searchVault(email);
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  // Count metrics for filters
  const countAll = vaultItems.length;
  const countFulfilled = useMemo(
    () => vaultItems.filter((o) => o.payment_status === 'FULFILLED' || o.payment_status === 'PAID_PROCESSING').length,
    [vaultItems]
  );
  const countUnpaid = useMemo(
    () => vaultItems.filter((o) => o.payment_status === 'PENDING_PAYMENT').length,
    [vaultItems]
  );

  // Filtered orders list
  const filteredItems = useMemo(() => {
    if (filter === 'FULFILLED') {
      return vaultItems.filter((o) => o.payment_status === 'FULFILLED' || o.payment_status === 'PAID_PROCESSING');
    }
    if (filter === 'UNPAID') {
      return vaultItems.filter((o) => o.payment_status === 'PENDING_PAYMENT');
    }
    return vaultItems;
  }, [vaultItems, filter]);

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
          ARSIP LISENSI &amp; PESANAN
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--body)', maxWidth: '560px', margin: '0 auto' }}>
          Pantau seluruh riwayat pesanan, tagihan belum dibayar, lisensi aktif bergaransi, dan kredensial privat Anda dalam satu tempat.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
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
            {loading ? 'Memeriksa Vault...' : 'CARI PESANAN ➔'}
          </button>
        </form>
      </div>

      {/* Result list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
          <span className="live-pulse-dot" style={{ marginRight: '8px' }} />
          <span>Membuka arsip pesanan dan lisensi aman Anda...</span>
        </div>
      ) : searched && vaultItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2 className="font-title-lg" style={{ color: 'var(--gold-light)', marginBottom: '8px' }}>
            Belum Ada Pesanan Terdaftar
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--body)', maxWidth: '480px', margin: '0 auto' }}>
            Tidak ditemukan riwayat transaksi untuk email: <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Pastikan email persis sama dengan saat melakukan pemesanan.
          </p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/" className="btn btn-primary">Lihat Katalog Produk</Link>
          </div>
        </div>
      ) : searched && (
        <div>
          {/* Filter Bar */}
          <div
            className="scrollable-chips-nav"
            style={{
              marginBottom: '20px',
              padding: '6px',
              backgroundColor: 'var(--surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--hairline)',
            }}
          >
            <button
              type="button"
              className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 'var(--radius-xs)' }}
              onClick={() => setFilter('ALL')}
            >
              Semua Pesanan ({countAll.toLocaleString('id-ID')})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'FULFILLED' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 'var(--radius-xs)' }}
              onClick={() => setFilter('FULFILLED')}
            >
              ✦ Lunas (Lisensi Aktif) ({countFulfilled.toLocaleString('id-ID')})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'UNPAID' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 'var(--radius-xs)' }}
              onClick={() => setFilter('UNPAID')}
            >
              ⏳ Belum Dibayar ({countUnpaid.toLocaleString('id-ID')})
            </button>
          </div>

          {/* Empty state for specific filter */}
          {filteredItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <p style={{ fontSize: '0.95rem', marginBottom: '6px', color: 'var(--ink)' }}>
                {filter === 'UNPAID'
                  ? 'Tidak ada pesanan yang belum dibayar. Semua transaksi Anda telah lunas!'
                  : 'Tidak ada pesanan pada kategori filter ini.'}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '12px', fontSize: '0.82rem' }}
                onClick={() => setFilter('ALL')}
              >
                Tampilkan Semua Pesanan
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filteredItems.map((order) => {
                const isFulfilled = order.payment_status === 'FULFILLED';
                const isPaidProcessing = order.payment_status === 'PAID_PROCESSING';
                const isPendingPayment = order.payment_status === 'PENDING_PAYMENT';
                const isExpired = order.payment_status === 'EXPIRED';
                const isRefunded = order.payment_status === 'REFUNDED';

                const orderDate = order.fulfilled_at || order.paid_at || order.created_at;
                const formattedDate = orderDate
                  ? new Date(orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '-';

                return (
                  <div key={order.order_number} className="card" style={{ position: 'relative' }}>
                    {/* Header Faktur */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--hairline)',
                        paddingBottom: '14px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Nomor Faktur
                        </span>
                        <div className="font-display" style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--gold-light)' }}>
                          {order.order_number}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Status Badge */}
                        {isFulfilled && (
                          <span className="badge badge-online" style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                            ✦ LUNAS &amp; AKTIF
                          </span>
                        )}
                        {isPaidProcessing && (
                          <span className="badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.76rem', padding: '4px 10px' }}>
                            ⚡ PROSES AKTIVASI
                          </span>
                        )}
                        {isPendingPayment && (
                          <span className="badge badge-warning" style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                            ⏳ MENUNGGU PEMBAYARAN
                          </span>
                        )}
                        {isExpired && (
                          <span className="badge badge-neutral" style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                            ✕ KADALUARSA
                          </span>
                        )}
                        {isRefunded && (
                          <span className="badge badge-neutral" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.76rem', padding: '4px 10px' }}>
                            ↩ DI-REFUND
                          </span>
                        )}

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                            Tanggal
                          </span>
                          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--body)' }}>
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Target Account Info (jika ada) */}
                    {order.target_account && (
                      <div style={{ fontSize: '0.86rem', color: 'var(--body)', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                        Email Akun Target: <strong style={{ color: 'var(--gold-light)' }}>{order.target_account}</strong>
                      </div>
                    )}

                    {/* KASUS 1: BELUM DIBAYAR (PENDING_PAYMENT) */}
                    {isPendingPayment && (
                      <div style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', padding: '16px', border: '1px solid var(--hairline)', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '1.02rem', color: 'var(--ink)', display: 'block' }}>
                              Tagihan: Rp {order.total_amount.toLocaleString('id-ID')}
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--gold-light)' }}>
                              Metode Pembayaran: {order.payment_method}
                            </span>
                          </div>

                          <Link
                            href={`/orders/${order.order_number}?token=${order.secure_token}`}
                            className="btn btn-primary"
                            style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700 }}
                          >
                            Bayar Sekarang (QRIS) ➔
                          </Link>
                        </div>

                        {order.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: '0.84rem', color: 'var(--muted)', borderTop: '1px solid var(--hairline)', paddingTop: '8px', marginTop: '6px' }}>
                            Produk: <strong style={{ color: 'var(--ink)' }}>{it.product_title}</strong> ({it.variant_name})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* KASUS 2: SEDANG DIPROSES SUPPLIER (PAID_PROCESSING) */}
                    {isPaidProcessing && (
                      <div style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', padding: '16px', border: '1px solid var(--hairline)', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '0.98rem', color: '#38bdf8', display: 'block' }}>
                              Pembayaran Terverifikasi Lunas
                            </strong>
                            <p style={{ fontSize: '0.84rem', color: 'var(--body)', margin: '4px 0 0' }}>
                              Tim supplier B-Vault sedang mengaktivasi lisensi akun Anda.
                            </p>
                          </div>

                          <Link
                            href={`/orders/${order.order_number}?token=${order.secure_token}`}
                            className="btn btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                          >
                            Pantau Aktivasi Realtime ➔
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* KASUS 3: KADALUARSA / EXPIRED */}
                    {isExpired && (
                      <div style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', padding: '14px 16px', border: '1px solid var(--hairline)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '0.86rem', color: 'var(--muted)', display: 'block' }}>
                            Batas waktu 10 menit telah terlampaui sehingga pesanan ini kadaluarsa.
                          </span>
                        </div>
                        <Link href="/" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                          Pesan Ulang di Katalog
                        </Link>
                      </div>
                    )}

                    {/* KASUS 4: LUNAS & AKTIF (FULFILLED) */}
                    {isFulfilled && (
                      <div>
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
                                    ✦ Garansi Aktif ({Number(it.warranty_days_left).toLocaleString('id-ID')} Hari Lagi)
                                  </span>
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Garansi Berakhir</span>
                                )}
                              </div>

                              {/* Activation Payload with Luxury Dark Box */}
                              {it.activation_payload && (
                                <div style={{ marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Kredensial / Tautan Lisensi Privat:
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 12px', fontSize: '0.78rem', minHeight: '32px' }}
                                      onClick={() => copyText(itemKey, it.activation_payload || '')}
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
                              )}

                              {it.admin_delivery_notes && (
                                <div style={{ fontSize: '0.84rem', color: 'var(--body)', marginBottom: '8px' }}>
                                  <strong style={{ color: 'var(--gold-light)' }}>Catatan Tim B-Vault:</strong> {it.admin_delivery_notes}
                                </div>
                              )}

                              {it.activation_guide && (
                                <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '10px', marginTop: '10px' }}>
                                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Petunjuk Aktivasi:
                                  </span>
                                  <p style={{ fontSize: '0.84rem', whiteSpace: 'pre-line', margin: 0, color: 'var(--body)', lineHeight: 1.5 }}>
                                    {it.activation_guide}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div style={{ textAlign: 'right', marginTop: '6px' }}>
                          <Link
                            href={`/orders/${order.order_number}?token=${order.secure_token}`}
                            style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}
                          >
                            Buka Bukti Faktur Resmi &rarr;
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
