'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Variant {
  id: number;
  product_id: number;
  name: string;
  duration_days: number;
  retail_price: number;
  input_requirement_label: string | null;
  estimated_delivery_text: string;
  warranty_duration_days: number;
  activation_guide: string;
}

interface Product {
  id: number;
  title: string;
  slug: string;
  platform_name: string;
  description: string;
  category_name: string;
  category_slug: string;
  variants: Variant[];
}

interface StoreInfo {
  status: 'ONLINE' | 'RESTING';
  notice: string;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [store, setStore] = useState<StoreInfo>({ status: 'ONLINE', notice: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Checkout modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [targetAccount, setTargetAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [agreeOperatingNotice, setAgreeOperatingNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/store/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products);
        setCategories(data.data.categories);
        setStore(data.data.store);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  }

  function openCheckout(product: Product, variant: Variant) {
    setActiveProduct(product);
    setActiveVariant(variant);
    setErrorMessage('');
    setAgreeOperatingNotice(false);
    setModalOpen(true);
  }

  function closeCheckout() {
    if (!submitting) {
      setModalOpen(false);
      setActiveVariant(null);
      setActiveProduct(null);
    }
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || name.trim().length < 3) {
      setErrorMessage('Nama lengkap pembeli wajib diisi minimal 3 karakter.');
      return;
    }

    if (store.status === 'RESTING' && !agreeOperatingNotice) {
      setErrorMessage('Harap centang konfirmasi jam operasional sebelum melanjutkan.');
      return;
    }

    if (!activeVariant) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/store/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: activeVariant.id,
          customer_name: name.trim(),
          customer_email: email,
          customer_whatsapp: whatsapp,
          target_account_input: targetAccount,
          payment_method: paymentMethod,
        }),
      });

      const json = await res.json();
      if (json.success) {
        router.push(json.data.redirect_url);
      } else {
        setErrorMessage(json.error?.message || 'Gagal memproses transaksi.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi kesalahan koneksi server.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category_slug === selectedCategory);

  return (
    <div className="container">
      {/* Store status banner */}
      {store.status === 'RESTING' ? (
        <div style={{
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '24px',
          color: 'var(--warning)'
        }}>
          <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>
            Mode Jam Istirahat Toko Aktif
          </strong>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            {store.notice || 'Pesanan tetap dapat dilakukan. Pemenuhan link lisensi akan diproses saat jam kerja dibuka.'}
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Layanan Penjualan Online
            </span>
          </div>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Estimasi proses supplier: <strong>5 sampai 20 menit</strong>
          </span>
        </div>
      )}

      {/* Hero Intro */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span className="badge badge-online">AMAN</span>
          <span className="badge badge-online">RESMI</span>
          <span className="badge badge-neutral">PRIVAT</span>
          <span className="badge badge-neutral">TERPERCAYA</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          B-Vault: Google AI & Aplikasi Pro
        </h1>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '6px' }}>
          Aplikasi Lisensi Pro Resmi. Aktif di Akun Pribadi Anda.
        </p>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '640px' }}>
          Pemesanan instan dengan sistem verifikasi QRIS dan Virtual Account otomatis. Butuh bantuan? WhatsApp: <strong>0851 8341 0190 (@barajapu_)</strong>
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          className={selectedCategory === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
          onClick={() => setSelectedCategory('all')}
        >
          Semua Kategori
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={selectedCategory === c.slug ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedCategory(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p>Memuat katalog produk...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p>Belum ada produk aktif di kategori ini.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {filteredProducts.map((product) => (
            <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge badge-neutral">{product.platform_name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Garansi Resmi
                  </span>
                </div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
                  {product.title}
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {product.description}
                </p>
              </div>

              {/* Variants inside product */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '12px' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Pilihan Varian:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {product.variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border-color)',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          SLA: {v.estimated_delivery_text} | Garansi {v.warranty_duration_days} Hari
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                          Rp {v.retail_price.toLocaleString('id-ID')}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => openCheckout(product, v)}
                        >
                          Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      {modalOpen && activeVariant && activeProduct && (
        <div className="modal-overlay" onClick={closeCheckout}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Checkout Pesanan</h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{activeProduct.title}</p>
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                aria-label="Tutup modal"
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Varian:</span>
                <strong style={{ fontSize: '0.9rem' }}>{activeVariant.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Estimasi Proses:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{activeVariant.estimated_delivery_text}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Total Pembayaran:</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                  Rp {activeVariant.retail_price.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {errorMessage && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.88rem' }}>
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="checkout-name">Nama Lengkap Pembeli (Wajib)</label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Nama pemilik pesanan untuk verifikasi faktur resmi.
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="checkout-email">Email Pribadi Pembeli (Wajib)</label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Salinan tautan lisensi dan faktur otomatis dikirimkan ke email ini.
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="checkout-wa">Nomor WhatsApp Pembeli (Wajib)</label>
                <input
                  id="checkout-wa"
                  type="tel"
                  required
                  placeholder="08123456789"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Untuk koordinasi kendala atau bantuan darurat tim CS.
                </span>
              </div>

              {activeVariant.input_requirement_label && (
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="checkout-target">
                    {activeVariant.input_requirement_label} (Wajib)
                  </label>
                  <input
                    id="checkout-target"
                    type="text"
                    required
                    placeholder="Masukkan data akun target yang ingin diupgrade..."
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Admin supplier akan mengundang atau mengaktivasi akun sesuai input ini.
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="checkout-payment">Metode Pembayaran</label>
                <select
                  id="checkout-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="QRIS">QRIS Dinamis (GoPay, OVO, Dana, ShopeePay, BCA, Mandiri)</option>
                  <option value="BCA_VA">BCA Virtual Account</option>
                  <option value="MANDIRI_VA">Mandiri Virtual Account</option>
                  <option value="BNI_VA">BNI Virtual Account</option>
                  <option value="BRI_VA">BRI Virtual Account</option>
                </select>
              </div>

              {store.status === 'RESTING' && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="agree-notice"
                    checked={agreeOperatingNotice}
                    onChange={(e) => setAgreeOperatingNotice(e.target.checked)}
                    style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }}
                  />
                  <label htmlFor="agree-notice" style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Saya mengerti saat ini toko sedang istirahat. Pesanan tetap diproses otomatis saat jam operasional kembali aktif.
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCheckout}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 2 }}
                >
                  {submitting ? 'Menyiapkan Pembayaran...' : 'Bayar Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
