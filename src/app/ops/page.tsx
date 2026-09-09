'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface AdminOrder {
  id: number;
  order_number: string;
  secure_token: string;
  customer_name?: string;
  customer_email: string;
  customer_phone: string;
  target_account_input: string | null;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  supplier_issue: boolean;
  elapsed_minutes: number;
  is_sla_warning: boolean;
  is_sla_breached: boolean;
  items: Array<{
    id: number;
    product_title: string;
    variant_name: string;
    unit_price: number;
    activation_payload: string | null;
    admin_delivery_notes: string | null;
  }>;
}

interface AnalyticsData {
  today: { date: string; gmv: number; net_profit: number };
  all_time: { gmv: number; net_profit: number };
  orders: { pending_fulfillment: number; fulfilled: number; pending_payment: number; refunded: number; expired: number };
  sla_performance: { target_sla_minutes: number; avg_fulfillment_seconds: number; avg_fulfillment_minutes: number; compliance_rate_percentage: number; breached_count: number };
}

function OpsConsoleInner() {
  const searchParams = useSearchParams();
  const focusOrder = searchParams.get('focus') || '';

  // Auth & 2FA State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('ops@b-vault.id');
  const [authPassword, setAuthPassword] = useState('');
  const [authTotp, setAuthTotp] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tabs: FULFILLMENT | ANALYTICS | SETTINGS
  const [activeTab, setActiveTab] = useState<'FULFILLMENT' | 'ANALYTICS' | 'SETTINGS'>('FULFILLMENT');

  // Fulfillment State
  const [filter, setFilter] = useState<'PENDING' | 'FULFILLED'>('PENDING');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  // Quick fulfillment input map per order { [orderId]: { payload, notes, loading } }
  const [fulfillInputs, setFulfillInputs] = useState<Record<number, { payload: string; notes: string; loading: boolean }>>({});
  const [fulfillMessage, setFulfillMessage] = useState<{ id: number; text: string; isError: boolean } | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Settings State
  const [storeStatus, setStoreStatus] = useState('ONLINE');
  const [operatingNotice, setOperatingNotice] = useState('');
  const [adminPhone, setAdminPhone] = useState('085183410190');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Auto-login if session stored in sessionStorage
  useEffect(() => {
    const cachedToken = sessionStorage.getItem('bv_ops_token');
    if (cachedToken) {
      setIsAuthenticated(true);
    }
  }, []);

  // Auth Handler
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/v1/ops/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          totp_code: authTotp,
        }),
      });

      const json = await res.json();
      if (json.success) {
        sessionStorage.setItem('bv_ops_token', json.data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(json.error?.message || 'Kredensial atau kode 2FA tidak valid.');
      }
    } catch {
      setAuthError('Gagal terhubung ke server autentikasi.');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('bv_ops_token');
    setIsAuthenticated(false);
  }

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch(`/api/v1/ops/orders/pending?filter=${filter}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
      }
    } catch (err) {
      console.error('Fetch ops orders error', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [filter]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await fetch('/api/v1/ops/analytics/summary');
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data);
      }
    } catch (err) {
      console.error('Fetch analytics error', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ops/settings/store-status');
      const json = await res.json();
      if (json.success) {
        setStoreStatus(json.data.store_status || 'ONLINE');
        setOperatingNotice(json.data.operating_hours_notice || '');
        setAdminPhone(json.data.admin_whatsapp || '085183410190');
        setTgToken(json.data.telegram_bot_token || '');
        setTgChatId(json.data.telegram_chat_id || '');
      }
    } catch (err) {
      console.error('Fetch settings error', err);
    }
  }, []);

  // Poll orders every 6s when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOrders();
    fetchSettings();
    if (activeTab === 'ANALYTICS') {
      fetchAnalytics();
    }
    const interval = setInterval(() => {
      fetchOrders();
      if (activeTab === 'ANALYTICS') fetchAnalytics();
    }, 6000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchOrders, fetchSettings, fetchAnalytics, activeTab]);

  // Handle Quick Fulfillment
  async function handleQuickFulfill(orderId: number) {
    const input = fulfillInputs[orderId] || { payload: '', notes: '' };
    if (!input.payload || input.payload.trim().length < 5) {
      setFulfillMessage({ id: orderId, text: 'Tautan / kredensial aktivasi wajib diisi minimal 5 karakter.', isError: true });
      return;
    }

    setFulfillInputs((prev) => ({ ...prev, [orderId]: { ...input, loading: true } }));
    setFulfillMessage(null);

    try {
      const res = await fetch(`/api/v1/ops/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activation_payload: input.payload,
          admin_delivery_notes: input.notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFulfillMessage({ id: orderId, text: 'Berhasil dikirim ke pembeli!', isError: false });
        // Clear input
        setFulfillInputs((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        fetchOrders();
        fetchAnalytics();
      } else {
        setFulfillMessage({ id: orderId, text: json.error?.message || 'Gagal menyerahkan lisensi.', isError: true });
      }
    } catch {
      setFulfillMessage({ id: orderId, text: 'Terjadi kesalahan jaringan.', isError: true });
    } finally {
      setFulfillInputs((prev) => ({ ...prev, [orderId]: { ...input, loading: false } }));
    }
  }

  // Handle Toggle Supplier Delay
  async function handleToggleSupplierIssue(orderId: number) {
    try {
      const res = await fetch(`/api/v1/ops/orders/${orderId}/supplier-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_ISSUE' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error('Supplier issue toggle error', err);
    }
  }

  // Save Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage('');
    try {
      const res = await fetch('/api/v1/ops/settings/store-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_status: storeStatus,
          operating_hours_notice: operatingNotice,
          admin_whatsapp: adminPhone,
          telegram_bot_token: tgToken,
          telegram_chat_id: tgChatId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSettingsMessage('Pengaturan toko berhasil diperbarui.');
      } else {
        setSettingsMessage(json.error?.message || 'Gagal menyimpan pengaturan.');
      }
    } catch {
      setSettingsMessage('Kesalahan koneksi saat menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  }

  // 1-Tap Copy
  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedTarget(id);
    setTimeout(() => setCopiedTarget(null), 2000);
  }

  // 1. Unauthenticated Login Gate
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ maxWidth: '440px', paddingTop: '80px' }}>
        <div className="card" style={{ padding: '32px 24px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', marginBottom: '12px' }}>
              B
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              B-Vault Operations Desk
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Akses khusus staf pemenuhan & admin toko (ops.b-vault.id)
            </p>
          </div>

          {authError && (
            <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="auth-email">Email Admin</label>
              <input
                id="auth-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="ops@b-vault.id"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="auth-pass">Kata Sandi</label>
              <input
                id="auth-pass"
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="auth-totp">Kode 2FA TOTP (Google Auth / PIN)</label>
              <input
                id="auth-totp"
                type="text"
                maxLength={6}
                value={authTotp}
                onChange={(e) => setAuthTotp(e.target.value)}
                placeholder="6 digit angka (contoh: 882399)"
                style={{ letterSpacing: '0.2em', fontSize: '1.1rem', textAlign: 'center', fontWeight: 700 }}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Default development PIN: <strong>882399</strong>
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={authLoading}
              style={{ width: '100%', padding: '12px' }}
            >
              {authLoading ? 'Memverifikasi Sesi...' : 'Buka Panel Operasional'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Authenticated Ops Console
  return (
    <div className="container" style={{ maxWidth: '960px', padding: '16px 12px 60px' }}>
      {/* Ops Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
            B
          </div>
          <div>
            <strong style={{ fontSize: '1.1rem', display: 'block' }}>B-Vault Ops Desk</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Status Toko: <strong style={{ color: storeStatus === 'ONLINE' ? 'var(--success)' : 'var(--warning)' }}>{storeStatus}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchOrders}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--danger)' }}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          type="button"
          className={activeTab === 'FULFILLMENT' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('FULFILLMENT')}
        >
          Quick Fulfillment ({orders.filter(o => o.payment_status === 'PAID_PROCESSING').length})
        </button>
        <button
          type="button"
          className={activeTab === 'ANALYTICS' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
          onClick={() => { setActiveTab('ANALYTICS'); fetchAnalytics(); }}
        >
          Analitik Keuangan & SLA
        </button>
        <button
          type="button"
          className={activeTab === 'SETTINGS' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('SETTINGS')}
        >
          Saklar Toko & Kontak
        </button>
      </div>

      {/* TAB 1: QUICK FULFILLMENT */}
      {activeTab === 'FULFILLMENT' && (
        <div>
          {/* Subfilter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={filter === 'PENDING' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                onClick={() => setFilter('PENDING')}
              >
                Perlu Diproses
              </button>
              <button
                type="button"
                className={filter === 'FULFILLED' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                onClick={() => setFilter('FULFILLED')}
              >
                Riwayat Selesai (50)
              </button>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Polling realtime: tiap 6 detik
            </span>
          </div>

          {loadingOrders ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Memuat antrean pemenuhan...
            </div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
                Tidak ada pesanan antrean saat ini.
              </p>
              <p style={{ fontSize: '0.85rem' }}>
                Pesanan lunas dari pembeli otomatis muncul di antrean ini.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order) => {
                const isPaidProcessing = order.payment_status === 'PAID_PROCESSING';
                const inputState = fulfillInputs[order.id] || { payload: '', notes: '', loading: false };
                const msg = fulfillMessage?.id === order.id ? fulfillMessage : null;

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      borderLeft: isPaidProcessing
                        ? (order.is_sla_breached ? '5px solid var(--danger)' : '5px solid var(--warning)')
                        : '5px solid var(--success)',
                      padding: '16px',
                    }}
                  >
                    {/* Header Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '1.05rem', fontFamily: 'monospace' }}>
                            {order.order_number}
                          </strong>
                          <span className={`badge ${isPaidProcessing ? (order.is_sla_breached ? 'badge-danger' : 'badge-warning') : 'badge-online'}`}>
                            {isPaidProcessing ? (order.is_sla_breached ? 'SLA LEWAT (>20m)' : 'LUNAS - PERLU LINK') : 'SELESAI'}
                          </span>
                          {order.supplier_issue && (
                            <span className="badge badge-warning" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                              Kendala Supplier Aktif
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Metode: {order.payment_method} &bull; Total: Rp {Number(order.total_amount).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {isPaidProcessing && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                            Waktu sejak lunas:
                          </span>
                          <strong style={{ fontSize: '1rem', color: order.is_sla_breached ? 'var(--danger)' : 'var(--warning)' }}>
                            {order.elapsed_minutes} Menit
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Customer & Target Account Block with 1-Tap Copy */}
                    <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Produk Dipesan:
                          </span>
                          <strong style={{ fontSize: '0.9rem' }}>
                            {order.items?.map(i => `${i.product_title} (${i.variant_name})`).join(', ') || 'Lisensi Pro'}
                          </strong>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Target Akun Pembeli (1-Tap Copy):
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <strong style={{ fontSize: '0.9rem', wordBreak: 'break-all', color: 'var(--primary)' }}>
                              {order.target_account_input || order.customer_email}
                            </strong>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => copyToClipboard(order.target_account_input || order.customer_email, `target-${order.id}`)}
                            >
                              {copiedTarget === `target-${order.id}` ? 'Tersalin!' : 'Salin'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Kontak Pembeli:
                          </span>
                          <span style={{ fontSize: '0.85rem' }}>
                            {order.customer_email} &bull; {order.customer_phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PRD v4: Single Text Input & Big "Kirim ke Pembeli" Button */}
                    {isPaidProcessing && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        {msg && (
                          <div style={{
                            backgroundColor: msg.isError ? 'var(--danger-bg)' : 'var(--success-bg)',
                            color: msg.isError ? 'var(--danger)' : 'var(--success)',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '10px',
                            fontSize: '0.85rem'
                          }}>
                            {msg.text}
                          </div>
                        )}

                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor={`payload-${order.id}`} style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Tempel Link Aktivasi / Kredensial Supplier:
                          </label>
                          <textarea
                            id={`payload-${order.id}`}
                            rows={2}
                            style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                            placeholder="Contoh: https://canva.com/brand/join?token=xxx atau Email: ... | Pass: ..."
                            value={inputState.payload}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFulfillInputs(prev => ({ ...prev, [order.id]: { ...inputState, payload: val } }));
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={inputState.loading}
                            onClick={() => handleQuickFulfill(order.id)}
                            style={{ flex: 2, minWidth: '180px', padding: '10px', fontWeight: 700 }}
                          >
                            {inputState.loading ? 'Mengirimkan...' : 'Kirim ke Pembeli'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleToggleSupplierIssue(order.id)}
                            style={{ flex: 1, minWidth: '140px', fontSize: '0.8rem', padding: '8px' }}
                          >
                            {order.supplier_issue ? 'Matikan Info Delay' : 'Tandai Gangguan Supplier'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* If fulfilled, show delivery summary */}
                    {!isPaidProcessing && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span>Diserahkan: {order.fulfilled_at ? new Date(order.fulfilled_at).toLocaleString('id-ID') : '-'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FINANCIAL ANALYTICS & SLA SUMMARY */}
      {activeTab === 'ANALYTICS' && (
        <div>
          {loadingAnalytics ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Menghitung ringkasan analitik keuangan & SLA...
            </div>
          ) : analytics ? (
            <div>
              {/* Financial Metrics */}
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                Metrik Finansial Toko
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Laba Bersih Hari Ini</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    Rp {Number(analytics.today.net_profit).toLocaleString('id-ID')}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Harga Jual - HPP Supplier
                  </span>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Omzet (GMV) Hari Ini</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    Rp {Number(analytics.today.gmv).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Laba Bersih (All-Time)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    Rp {Number(analytics.all_time.net_profit).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total GMV (All-Time)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Rp {Number(analytics.all_time.gmv).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* SLA Metrics */}
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                Kinerja SLA Kecepatan Pemenuhan (Target: &le; 20 Menit)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rata-rata Waktu Proses</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {analytics.sla_performance.avg_fulfillment_minutes} Menit
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({analytics.sla_performance.avg_fulfillment_seconds} detik)
                  </span>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tingkat Kepatuhan SLA</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    {analytics.sla_performance.compliance_rate_percentage}%
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pesanan diproses &le; 20 menit
                  </span>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pelanggaran SLA (&gt;20m)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: analytics.sla_performance.breached_count > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {analytics.sla_performance.breached_count} Pesanan
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: SAKLAR TOKO & SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>
            Saklar Operasional & Pengaturan Toko
          </h2>

          {settingsMessage && (
            <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.88rem' }}>
              {settingsMessage}
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="ops-status">Status Operasional Toko (Operating Hours Switch)</label>
              <select
                id="ops-status"
                value={storeStatus}
                onChange={(e) => setStoreStatus(e.target.value)}
              >
                <option value="ONLINE">ONLINE (Layanan aktif, estimasi 5 - 20 menit)</option>
                <option value="RESTING">ISTIRAHAT (Toko tutup sementara / antrean malam)</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Jika mode istirahat aktif, pembeli melihat notifikasi penjadwalan proses saat checkout.
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="ops-notice">Pemberitahuan Jam Istirahat</label>
              <input
                id="ops-notice"
                type="text"
                value={operatingNotice}
                onChange={(e) => setOperatingNotice(e.target.value)}
                placeholder="Toko sedang istirahat. Pesanan diproses mulai pukul 08:00 WIB."
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="ops-phone">Nomor Kontak WhatsApp CS Toko</label>
              <input
                id="ops-phone"
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="085183410190"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="ops-tg-token">Telegram Bot Token (Opsional)</label>
              <input
                id="ops-tg-token"
                type="password"
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl..."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="ops-tg-chat">Telegram Admin Chat ID (Opsional)</label>
              <input
                id="ops-tg-chat"
                type="text"
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
                placeholder="-100123456789"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSettings}
              style={{ padding: '10px 24px' }}
            >
              {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function OpsDeskPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Memuat Ops Desk...</div>}>
      <OpsConsoleInner />
    </Suspense>
  );
}
