'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

interface OrderData {
  id: number;
  order_number: string;
  customer_email: string;
  customer_phone: string;
  target_account_input: string | null;
  total_amount: number;
  payment_status: 'PENDING_PAYMENT' | 'PAID_PROCESSING' | 'FULFILLED' | 'EXPIRED' | 'REFUNDED';
  payment_method: string;
  payment_channel_data: any;
  supplier_issue: boolean;
  paid_at: string | null;
  expired_at: string;
  fulfilled_at: string | null;
  created_at: string;
  elapsed_minutes_since_paid: number;
}

interface OrderItem {
  id: number;
  product_title: string;
  platform_name: string;
  variant_name: string;
  duration_days: number;
  unit_price: number;
  estimated_delivery_text: string;
  activation_payload: string | null;
  admin_delivery_notes: string | null;
  activation_guide: string | null;
  warranty_expired_at: string | null;
}

interface SupportInfo {
  admin_whatsapp: string;
  is_sla_breached: boolean;
  store_status: string;
  store_notice: string;
}

function OrderStatusContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderNumber = params.orderNumber as string;
  const token = searchParams.get('token') || '';

  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!token) {
      setError('Token otorisasi pesanan tidak ditemukan pada tautan.');
      setLoading(false);
      return;
    }

    try {
      if (!isSilent && !order) {
        setLoading(true);
      }
      const res = await fetch(`/api/v1/store/orders/${token}`);
      const json = await res.json();
      if (json.success) {
        setOrder(json.data.order);
        setItems(json.data.items);
        setSupport(json.data.support);
        setError('');

        // Calculate countdown
        if (json.data.order.payment_status === 'PENDING_PAYMENT') {
          const exp = new Date(json.data.order.expired_at).getTime();
          const diff = Math.max(0, Math.floor((exp - Date.now()) / 1000));
          setTimeLeftSeconds(diff);
        }
      } else {
        if (!isSilent) setError(json.error?.message || 'Pesanan tidak ditemukan.');
      }
    } catch {
      if (!isSilent) setError('Gagal memuat status pesanan.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [token, order]);

  // Initial fetch and 3-second silent background polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      // Poll silently while in intermediate states without showing page loading animation
      if (order?.payment_status === 'PENDING_PAYMENT' || order?.payment_status === 'PAID_PROCESSING') {
        fetchStatus(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus, order?.payment_status]);

  // Local timer tick
  useEffect(() => {
    if (timeLeftSeconds === null || timeLeftSeconds < 0) return;
    if (timeLeftSeconds === 0) {
      fetchStatus(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev !== null && prev > 0) {
          if (prev - 1 === 0) {
            fetchStatus(true);
          }
          return prev - 1;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftSeconds, fetchStatus]);

  // Check if current user is admin (via session storage or auth session)
  useEffect(() => {
    async function checkAdminStatus() {
      if (typeof window !== 'undefined' && sessionStorage.getItem('bv_ops_token')) {
        setIsAdmin(true);
        return;
      }
      try {
        const res = await fetch('/api/v1/auth/session');
        const json = await res.json();
        if (json.success && json.data?.authenticated && json.data.user) {
          const u = json.data.user;
          const uEmail = (u.email || '').toLowerCase().trim();
          const adminList = ['barajapu23@gmail.com', 'agilezone9@gmail.com', 'ops@b-vault.id', 'admin@b-vault.id'];
          if (u.role === 'admin' || adminList.includes(uEmail)) {
            setIsAdmin(true);
          }
        }
      } catch {}
    }
    checkAdminStatus();
  }, []);

  async function handleSimulatePayment() {
    if (!order) return;
    try {
      setSimulatingPayment(true);
      const res = await fetch('/api/v1/webhooks/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: order.order_number,
          status: 'PAID',
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Simulate payment error', err);
    } finally {
      setSimulatingPayment(false);
    }
  }

  async function handleSimulateFulfill() {
    if (!order) return;
    try {
      setSimulatingPayment(true);
      const mockKey = `BV-${order.order_number}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const res = await fetch(`/api/v1/ops/orders/${order.id}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activation_payload: `https://vault.b-vault.id/redeem/${mockKey}`,
          admin_delivery_notes: 'Lisensi otomatis disimulasikan dari simulator admin.',
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Simulate fulfill error', err);
    } finally {
      setSimulatingPayment(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  }

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (loading && !order) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>Memuat status pesanan...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ maxWidth: '600px', margin: '40px auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '12px' }}>Akses Pesanan Tidak Valid</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
          <Link href="/" className="btn btn-primary">Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  const firstItem = items[0];

  // Stepper state calculation
  const isTimeExpired = order.expired_at ? new Date(order.expired_at).getTime() < Date.now() : false;
  const isPaid = ['PAID_PROCESSING', 'FULFILLED'].includes(order.payment_status);
  const isFulfilled = order.payment_status === 'FULFILLED';
  const isExpired = order.payment_status === 'EXPIRED' || (order.payment_status === 'PENDING_PAYMENT' && (timeLeftSeconds === 0 || isTimeExpired));
  const isRefunded = order.payment_status === 'REFUNDED';

  // WhatsApp emergency message
  const rawSupportWa = support?.admin_whatsapp || '085861708659';
  const cleanWa = rawSupportWa.replace(/\D/g, '');
  const waNumber = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : (cleanWa || '6285861708659');

  const productLabel = firstItem ? `${firstItem.product_title || 'Lisensi'} (${firstItem.variant_name || 'Akses'})` : 'Lisensi Pro';
  const waConfirmText = [
    `Halo CS B-Vault, saya sudah melakukan transfer pembayaran:`,
    `--------------------------------`,
    `Invoice: ${order.order_number}`,
    `Produk: ${productLabel}`,
    `Total: Rp ${order.total_amount.toLocaleString('id-ID')}`,
    `Email: ${order.customer_email}`,
    order.target_account_input ? `Target Akun: ${order.target_account_input}` : '',
    `--------------------------------`,
    `Berikut saya lampirkan bukti transfer. Mohon verifikasi & segera diserahkan lisensinya. Terima kasih!`
  ].filter(Boolean).join('\n');
  const waConfirmUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waConfirmText)}`;

  const waMessage = encodeURIComponent(
    `Halo Admin B-Vault, saya sudah bayar untuk pesanan ${order.order_number} (${firstItem?.product_title || 'Lisensi'}) namun proses sudah melebihi 20 menit. Mohon bantuan pengecekan aktivasi.`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waMessage}`;

  return (
    <div className="container" style={{ maxWidth: '780px' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nomor Faktur Pesanan</span>
          <h1 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)' }}>{order.order_number}</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pembayaran</span>
          <div className="font-display" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gold-light)' }}>
            Rp {order.total_amount.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Supplier Issue Alert */}
      {order.supplier_issue && !isFulfilled && (
        <div style={{
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
          color: 'var(--warning)'
        }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>
            Pemberitahuan Antrean Aktivasi Supplier
          </strong>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            Server aktivasi pusat sedang mengalami antrean tinggi. Tim kami sedang mengalihkan pesanan Anda ke server cadangan agar lisensi segera aktif.
          </p>
        </div>
      )}

      {/* Live Stepper */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="stepper-container">
          <div className={`step-item ${order.payment_status === 'PENDING_PAYMENT' ? 'active' : isPaid ? 'completed' : ''}`}>
            <div className="step-circle">{isPaid ? '✓' : '1'}</div>
            <div className="step-title">Pembayaran</div>
          </div>

          <div className={`step-item ${order.payment_status === 'PAID_PROCESSING' ? 'active' : isFulfilled ? 'completed' : ''}`}>
            <div className="step-circle">{isFulfilled ? '✓' : '2'}</div>
            <div className="step-title">Verifikasi Lunas</div>
          </div>

          <div className={`step-item ${order.payment_status === 'PAID_PROCESSING' ? 'active' : isFulfilled ? 'completed' : ''}`}>
            <div className="step-circle">{isFulfilled ? '✓' : '3'}</div>
            <div className="step-title">Proses Aktivasi</div>
          </div>

          <div className={`step-item ${isFulfilled ? 'completed active' : ''}`}>
            <div className="step-circle">{isFulfilled ? '✓' : '4'}</div>
            <div className="step-title">Lisensi Diterima</div>
          </div>
        </div>

        {/* Phase Details Box */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          {/* STEP 1: PENDING PAYMENT */}
          {order.payment_status === 'PENDING_PAYMENT' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  Menunggu Pembayaran
                </h2>
                {timeLeftSeconds !== null && (
                  <div className="badge badge-warning" style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                    Sisa Waktu: {formatTime(timeLeftSeconds)}
                  </div>
                )}
              </div>

              {order.payment_method === 'QRIS' ? (
                <div style={{ textAlign: 'center', padding: '20px 16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <span className="badge badge-online" style={{ fontSize: '0.74rem', marginBottom: '6px' }}>
                      QRIS STANDAR PEMBAYARAN NASIONAL
                    </span>
                    <h3 className="font-title-md" style={{ color: 'var(--ink)', marginTop: '4px', fontSize: '1.1rem' }}>
                      BARAJA PUTRA, DIGITAL &amp; KREATIF
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      NMID: <strong style={{ color: 'var(--gold-light)' }}>ID1026505289292</strong>
                    </span>
                  </div>

                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Pindai QRIS berikut menggunakan aplikasi m-Banking atau E-Wallet (BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay):
                  </p>

                  <div style={{
                    display: 'inline-block',
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--hairline)',
                    marginBottom: '14px',
                    maxWidth: '320px',
                    width: '100%',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)'
                  }}>
                    <img
                      src="/qris-all-pay.jpeg"
                      alt="QRIS Baraja Putra, Digital & Kreatif"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        borderRadius: 'var(--radius-xs)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <a
                      href="/qris-all-pay.jpeg"
                      download="qris-baraja-putra.jpeg"
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>📥</span>
                      <span>Unduh Gambar QRIS</span>
                    </a>
                    <a
                      href="/qris-all-pay.jpeg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>🔍</span>
                      <span>Perbesar QRIS</span>
                    </a>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--gold-light)' }}>
                    Setelah transfer berhasil, konfirmasi pembayaran Anda agar pesanan segera diproses.
                  </p>
                </div>
              ) : (
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Nomor Virtual Account {order.payment_channel_data?.bank || 'Bank'}:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      {order.payment_channel_data?.va_number || '8801234567890'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '0.84rem' }}
                      onClick={() => copyToClipboard(order.payment_channel_data?.va_number || '')}
                    >
                      {copiedText ? 'Tersalin' : 'Salin Nomor VA'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Transfer sesuai nominal tepat Rp {order.total_amount.toLocaleString('id-ID')}.
                  </p>
                </div>
              )}

              {/* Tombol Konfirmasi Pembayaran Pembeli */}
              <div style={{
                marginTop: '18px',
                padding: '16px 14px',
                backgroundColor: 'var(--surface-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--hairline)',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--gold-light)', marginBottom: '12px', fontWeight: 600 }}>
                  Sudah menyelesaikan transfer pembayaran?
                </p>
                <a
                  href={waConfirmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 14px',
                    fontSize: 'clamp(0.85rem, 3.6vw, 0.95rem)',
                    fontWeight: 700,
                    width: '100%',
                    maxWidth: '380px',
                    minWidth: 0,
                    margin: '0 auto',
                    backgroundColor: '#25D366',
                    borderColor: '#25D366',
                    color: '#ffffff',
                    boxShadow: '0 4px 16px rgba(37, 211, 102, 0.35)',
                    whiteSpace: 'normal',
                    textAlign: 'center',
                    lineHeight: 1.35,
                    boxSizing: 'border-box',
                    wordBreak: 'break-word',
                  }}
                >
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💬</span>
                  <span>Konfirmasi Pembayaran via WhatsApp</span>
                </a>
                <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--muted)', marginTop: '8px' }}>
                  Kirimkan bukti transfer untuk verifikasi instan (Estimasi 5 - 20 menit).
                </span>
              </div>

              {/* Developer / Testing Simulator Button (Hanya Akun Admin) */}
              {isAdmin && (
                <div style={{ marginTop: '20px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      [SIMULATOR ADMIN] Ingin menguji webhook pelunasan otomatis?
                    </span>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleSimulatePayment}
                      disabled={simulatingPayment}
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      {simulatingPayment ? 'Mengirim Webhook...' : 'Simulasikan Bayar Lunas'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 & 3: PAID_PROCESSING */}
          {order.payment_status === 'PAID_PROCESSING' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--success)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  ✓
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
                    Pembayaran Lunas Diverifikasi
                  </h2>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Notifikasi telah ditembakkan ke bot admin. Tim aktivasi sedang menghubungkan lisensi Anda.
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Status Antrean:</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary)' }}>Sedang Diproses Supplier</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Target Akun:</span>
                  <strong style={{ fontSize: '0.88rem' }}>{order.target_account_input || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Waktu Berjalan:</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{Number(order.elapsed_minutes_since_paid || 0).toLocaleString('id-ID')} Menit</span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Halaman ini akan otomatis menampilkan tautan / lisensi begitu admin menempelkan data aktivasi. Tidak perlu memuat ulang halaman secara manual.
              </p>

              {/* Admin Simulator: Selesaikan Pesanan Langsung */}
              {isAdmin && (
                <div style={{ marginTop: '20px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      [SIMULATOR ADMIN] Ingin menyelesaikan pesanan & serahkan lisensi instan?
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSimulateFulfill}
                      disabled={simulatingPayment}
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      {simulatingPayment ? 'Menyerahkan Lisensi...' : 'Selesaikan Pesanan & Kirim Lisensi'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FULFILLED */}
          {order.payment_status === 'FULFILLED' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--success)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  ✓
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Lisensi Berhasil Diserahkan
                  </h2>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Silakan ikuti instruksi aktivasi di bawah ini.
                  </span>
                </div>
              </div>

              {/* License Payload Box */}
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '2px solid var(--primary)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                    Tautan / Kredensial Lisensi Anda:
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                    onClick={() => copyToClipboard(firstItem?.activation_payload || '')}
                  >
                    {copiedText ? 'Tersalin' : 'Salin Lisensi'}
                  </button>
                </div>

                <div style={{
                  backgroundColor: 'var(--canvas)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--hairline)',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  color: 'var(--gold-light)',
                  wordBreak: 'break-all',
                  marginBottom: '12px'
                }}>
                  {firstItem?.activation_payload || '-'}
                </div>

                {firstItem?.admin_delivery_notes && (
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <strong>Catatan Tambahan Admin:</strong> {firstItem.admin_delivery_notes}
                  </div>
                )}
              </div>

              {/* Activation Guide */}
              {firstItem?.activation_guide && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                    Panduan Langkah Aktivasi:
                  </h3>
                  <div style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-line',
                    lineHeight: 1.6
                  }}>
                    {firstItem.activation_guide}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPIRED or REFUNDED */}
          {isExpired && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
                Waktu Pembayaran Telah Berakhir
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Invoice ini otomatis dibatalkan karena batas pembayaran 10 menit telah terlampaui.
              </p>
              <Link href="/" className="btn btn-primary">Pesan Ulang</Link>
            </div>
          )}

          {isRefunded && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
                Pesanan Telah Di-Refund
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Dana pesanan ini telah dikembalikan oleh admin karena kendala aktivasi supplier.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Emergency CS WhatsApp Section */}
      {order.payment_status === 'PAID_PROCESSING' && (
        <div style={{
          backgroundColor: support?.is_sla_breached ? 'var(--warning-bg)' : 'var(--bg-surface)',
          border: '1px solid',
          borderColor: support?.is_sla_breached ? 'var(--warning-border)' : 'var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: support?.is_sla_breached ? 'var(--warning)' : 'var(--text-primary)' }}>
              {support?.is_sla_breached
                ? 'Pesanan Melebihi Estimasi Normal (20 Menit)'
                : 'Pusat Bantuan Pelanggan'}
            </strong>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              {support?.is_sla_breached
                ? 'Hubungi admin langsung via WhatsApp untuk pengecekan prioritas manual.'
                : 'Tombol bantuan darurat WhatsApp akan aktif jika proses aktivasi melebihi 20 menit.'}
            </p>
          </div>

          {support?.is_sla_breached ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-danger"
              style={{ padding: '8px 16px', fontSize: '0.88rem' }}
            >
              Hubungi Admin via WhatsApp
            </a>
          ) : (
            <span className="badge badge-neutral">SLA Normal (3 - 15 Menit)</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense fallback={<div className="container" style={{ textAlign: 'center', padding: '60px 0' }}><p>Memuat status pesanan...</p></div>}>
      <OrderStatusContent />
    </Suspense>
  );
}

