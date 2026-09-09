'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GoogleAuthButton from '@/components/GoogleAuthButton';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [store, setStore] = useState<StoreInfo>({ status: 'ONLINE', notice: '' });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'warranty'>('featured');

  // Selected Variant on each product card { [productId]: variantId }
  const [selectedCardVariants, setSelectedCardVariants] = useState<Record<number, number>>({});
  const [expandedGuideProductId, setExpandedGuideProductId] = useState<number | null>(null);

  // Checkout modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [targetAccount, setTargetAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [agreeOperatingNotice, setAgreeOperatingNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Interactive Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');

  // Floating Live Activity from Real Orders
  const [activities, setActivities] = useState<string[]>([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [showToast, setShowToast] = useState(true);

  // FAQ Accordion
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Activity ticker timer for real database orders
  useEffect(() => {
    if (activities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((prev) => (prev + 1) % activities.length);
      setShowToast(true);
    }, 7000);
    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    fetchProducts();
    checkAuthSession();
  }, []);

  async function checkAuthSession() {
    try {
      const res = await fetch('/api/v1/auth/session');
      const json = await res.json();
      if (json.success && json.data?.authenticated) {
        setAuthUser(json.data.user);
        if (json.data.user.name) setName((prev) => prev || json.data.user.name);
        if (json.data.user.email) setEmail((prev) => prev || json.data.user.email);
      }
    } catch {}
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/store/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products || []);
        setCategories(data.data.categories || []);
        setStore(data.data.store || { status: 'ONLINE', notice: '' });
        setActivities(data.data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  }

  // Active products & categories to display from DB
  const effectiveProducts = useMemo(() => products, [products]);
  const effectiveCategories = useMemo(() => categories, [categories]);

  // Filter & Sort Logic
  const processedProducts = useMemo(() => {
    let list = [...effectiveProducts];

    // 1. Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category_slug === selectedCategory);
    }

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.platform_name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.variants.some((v) => v.name.toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    list.sort((a, b) => {
      const aPrice = a.variants[0]?.retail_price || 0;
      const bPrice = b.variants[0]?.retail_price || 0;
      const aWarranty = a.variants[0]?.warranty_duration_days || 0;
      const bWarranty = b.variants[0]?.warranty_duration_days || 0;

      if (sortBy === 'price-asc') return aPrice - bPrice;
      if (sortBy === 'price-desc') return bPrice - aPrice;
      if (sortBy === 'warranty') return bWarranty - aWarranty;
      return 0; // featured
    });

    return list;
  }, [effectiveProducts, selectedCategory, searchQuery, sortBy]);

  // Open checkout modal with selected variant
  function openCheckout(product: Product, variant?: Variant) {
    const chosenVariant = variant || product.variants.find((v) => v.id === selectedCardVariants[product.id]) || product.variants[0];
    setActiveProduct(product);
    setActiveVariant(chosenVariant);
    setErrorMessage('');
    setAgreeOperatingNotice(false);
    setCouponCode('');
    setDiscountAmount(0);
    setCouponApplied(false);
    setCouponMessage('');
    setModalOpen(true);
  }

  function closeCheckout() {
    if (!submitting) {
      setModalOpen(false);
      setActiveVariant(null);
      setActiveProduct(null);
    }
  }

  // Interactive Coupon Handler
  function handleApplyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!activeVariant) return;

    if (code === 'BVAULTHEMAT' || code === 'BARAJAPU') {
      const discount = Math.round(activeVariant.retail_price * 0.1);
      setDiscountAmount(discount);
      setCouponApplied(true);
      setCouponMessage(`Kupon ${code} aktif! Diskon Rp ${discount.toLocaleString('id-ID')} berhasil diterapkan.`);
    } else {
      setCouponApplied(false);
      setDiscountAmount(0);
      setCouponMessage('Kode kupon tidak valid atau telah kedaluwarsa.');
    }
  }

  // Checkout submission
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
    } catch {
      setErrorMessage('Terjadi kesalahan koneksi server.');
    } finally {
      setSubmitting(false);
    }
  }

  const finalAmount = activeVariant ? Math.max(0, activeVariant.retail_price - discountAmount) : 0;

  return (
    <div className="container" style={{ position: 'relative' }}>

      {/* Store status banner */}
      {store.status === 'RESTING' ? (
        <div style={{
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '24px',
          color: 'var(--warning)',
        }}>
          <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>
            Mode Jam Istirahat Toko Aktif
          </strong>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            {store.notice || 'Pesanan tetap dapat dilakukan. Pemenuhan link lisensi akan diproses saat jam kerja dibuka kembali.'}
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="live-pulse-dot" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Layanan Penjualan Online Aktif
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>Estimasi aktivasi: <strong style={{ color: 'var(--gold-light)', backgroundColor: 'rgba(219, 177, 99, 0.14)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>5 - 20 Menit</strong></span>
            <span className="desktop-nav-item">&bull;</span>
            <span>WhatsApp CS: <strong style={{ color: 'var(--ink)' }}>0851 8341 0190</strong></span>
          </div>
        </div>
      )}

      {/* Hero Intro with Luxury Private Vault Aesthetics */}
      <div style={{ marginBottom: '28px', textAlign: 'center', maxWidth: '840px', margin: '0 auto 28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '5px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(219, 177, 99, 0.08)', border: '1px solid var(--hairline)' }}>
          <span style={{ color: 'var(--accent-gold)', fontSize: '0.8rem' }}>✦</span>
          <span className="font-label-uppercase" style={{ color: 'var(--gold-light)', fontSize: '0.72rem', letterSpacing: '0.12em' }}>
            GARANSI ANTI-REVOKE 100% RESMI
          </span>
          <span style={{ color: 'var(--accent-gold)', fontSize: '0.8rem' }}>✦</span>
        </div>

        <h1 className="font-display-lg" style={{ color: '#ffffff', marginBottom: '12px' }}>
          PRO LICENSE & DIGITAL VAULT
        </h1>
        <p style={{ fontSize: 'clamp(0.96rem, 3.2vw, 1.15rem)', fontWeight: 600, color: 'var(--gold-light)', marginBottom: '10px', lineHeight: 1.4 }}>
          Aplikasi Lisensi Pro Resmi. Aktif di Akun Pribadi Anda.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--body)', maxWidth: '640px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Platform lisensi software resmi, tools AI, dan aplikasi produktivitas bergaransi penuh. Transaksi instan verifikasi QRIS otomatis & Virtual Account 24 jam dengan proteksi aktivasi terpercaya.
        </p>

        {/* 3 Metrik Kepercayaan (Trust Stats) - Clean 3-Column Mobile Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          padding: '12px 8px',
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--hairline)',
          marginTop: '14px'
        }}>
          <div>
            <strong className="font-display" style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.4rem)', color: 'var(--gold-light)', display: 'block' }}>
              1.200+
            </strong>
            <span style={{ fontSize: 'clamp(0.64rem, 2vw, 0.76rem)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Lisensi Terkirim
            </span>
          </div>
          <div style={{ borderLeft: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)' }}>
            <strong className="font-display" style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.4rem)', color: 'var(--gold-light)', display: 'block' }}>
              99.8%
            </strong>
            <span style={{ fontSize: 'clamp(0.64rem, 2vw, 0.76rem)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Uptime Garansi
            </span>
          </div>
          <div>
            <strong className="font-display" style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.4rem)', color: 'var(--gold-light)', display: 'block' }}>
              7/24
            </strong>
            <span style={{ fontSize: 'clamp(0.64rem, 2vw, 0.76rem)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operator Siaga
            </span>
          </div>
        </div>
      </div>

      {/* Signature Metallic Gold Cross Divider with ✦ Symbol from DESIGN.md */}
      <div className="gold-cross-divider">
        <div className="gold-cross-badge">✦</div>
      </div>

      {/* Interactive Controls Bar: Search, Category, Sorting */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          {/* Live Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 'min(100%, 220px)' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari produk (misal: Canva, Google, Claude) - Tekan '/' ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingRight: '36px' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  minHeight: 'auto',
                  minWidth: 'auto',
                  padding: '4px',
                }}
              >
                &times;
              </button>
            )}
          </div>

          {/* Interactive Sorting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 1 auto', minWidth: 'min(100%, 180px)' }}>
            <label htmlFor="sort-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Urutkan:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ fontSize: '0.86rem', padding: '8px 12px' }}
            >
              <option value="featured">Rekomendasi</option>
              <option value="price-asc">Harga: Termurah</option>
              <option value="price-desc">Harga: Tertinggi</option>
              <option value="warranty">Garansi Terlama</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="scrollable-chips-nav">
          <button
            type="button"
            className={selectedCategory === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => setSelectedCategory('all')}
          >
            Semua ({effectiveProducts.length})
          </button>
          {effectiveCategories.map((c) => {
            const count = effectiveProducts.filter((p) => p.category_slug === c.slug).length;
            return (
              <button
                key={c.id}
                type="button"
                className={selectedCategory === c.slug ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setSelectedCategory(c.slug)}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <span className="live-pulse-dot" style={{ marginRight: '8px' }} />
          <span>Memuat katalog lisensi B-Vault...</span>
        </div>
      ) : processedProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔒</div>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gold-light)', marginBottom: '8px' }}>
            {searchQuery ? `Tidak ada produk yang cocok dengan "${searchQuery}".` : 'Belum Ada Produk di Katalog'}
          </p>
          <p style={{ fontSize: '0.88rem', color: 'var(--body)', maxWidth: '480px', margin: '0 auto 16px', lineHeight: 1.6 }}>
            {searchQuery
              ? 'Coba gunakan kata kunci lain atau reset filter pencarian Anda.'
              : 'Katalog produk saat ini masih kosong. Silakan tambahkan produk baru melalui panel admin /ops.'}
          </p>
          {searchQuery ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSearchQuery('')}
              style={{ marginTop: '8px', fontSize: '0.85rem' }}
            >
              Reset Pencarian
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push('/ops')}
              style={{ marginTop: '8px', fontSize: '0.85rem' }}
            >
              Buka Panel Admin / Kelola Produk
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
          gap: '16px',
          marginBottom: '48px',
        }}>
          {processedProducts.map((product) => {
            const selectedVariantId = selectedCardVariants[product.id] || product.variants[0]?.id;
            const activeVar = product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
            const isGuideOpen = expandedGuideProductId === product.id;

            return (
              <div
                key={product.id}
                className="card card-interactive"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-online" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                        {product.platform_name}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                        RESMI
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--gold-light)', fontWeight: 600 }}>
                      Garansi {activeVar?.warranty_duration_days} Hari
                    </span>
                  </div>

                  <h2 className="font-title-lg" style={{ color: 'var(--ink)', marginBottom: '10px' }}>
                    {product.title}
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--body)', marginBottom: '16px', minHeight: '44px', lineHeight: 1.5 }}>
                    {product.description}
                  </p>

                  {/* Interactive Variant Switcher Pills */}
                  {product.variants.length > 1 && (
                    <div style={{ marginBottom: '16px' }}>
                      <span className="font-label-uppercase" style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                        Pilih Durasi & Tipe Akses:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {product.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            className={`variant-chip ${v.id === selectedVariantId ? 'active' : ''}`}
                            onClick={() => setSelectedCardVariants((prev) => ({ ...prev, [product.id]: v.id }))}
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price & Value Block matching DESIGN.md */}
                  <div style={{
                    backgroundColor: 'var(--surface-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '14px 16px',
                    marginBottom: '16px',
                    border: '1px solid var(--hairline)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Harga Lisensi Resmi
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                          <strong className="font-price-display">
                            Rp {activeVar?.retail_price.toLocaleString('id-ID')}
                          </strong>
                        </div>
                      </div>
                      <span className="badge badge-online" style={{ fontSize: '0.75rem' }}>
                        ⚡ {activeVar?.estimated_delivery_text}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Activation Guide Toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedGuideProductId(isGuideOpen ? null : product.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.82rem',
                      color: 'var(--accent-gold)',
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: '16px',
                      minHeight: 'auto',
                      minWidth: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                    }}
                  >
                    <span>{isGuideOpen ? 'Sembunyikan Panduan Aktivasi' : 'Lihat Panduan Aktivasi'}</span>
                    <span style={{ fontSize: '0.75rem' }}>{isGuideOpen ? '▲' : '▼'}</span>
                  </button>

                  {isGuideOpen && (
                    <div style={{
                      backgroundColor: 'var(--surface-elevated)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.82rem',
                      color: 'var(--body)',
                      whiteSpace: 'pre-line',
                      marginBottom: '16px',
                      borderLeft: '3px solid var(--accent-gold)',
                      lineHeight: 1.5,
                    }}>
                      {activeVar?.activation_guide}
                    </div>
                  )}
                </div>

                {/* Buy Button: Velvet Red #640509 with Hairline Gold border */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => openCheckout(product, activeVar)}
                  style={{ width: '100%', padding: '14px', fontWeight: 700, letterSpacing: '0.04em' }}
                >
                  AMANKAN SEKARANG &rarr;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive FAQ Section */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px', textAlign: 'center' }}>
          Pertanyaan Umum (FAQ) Seputar B-Vault
        </h2>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {[
            {
              q: 'Bagaimana cara akun saya diaktivasi setelah pembayaran berhasil?',
              a: 'Setelah pembayaran diverifikasi oleh QRIS/VA otomatis, invoice Anda akan langsung menampilkan tautan aktivasi resmi (invite link) atau kredensial privat. Panduan langkah demi langkah juga ditampilkan seketika di layar Anda.',
            },
            {
              q: 'Berapa lama rata-rata proses aktivasi lisensi?',
              a: 'Estimasi standar kami adalah 5 hingga 20 menit pada jam kerja online. Jika pesanan Anda melebihi 20 menit, tombol eskalasi darurat WhatsApp CS otomatis aktif di invoice Anda untuk bantuan prioritas langsung.',
            },
            {
              q: 'Apakah lisensi B-Vault dilengkapi garansi?',
              a: 'Ya, seluruh produk dilengkapi garansi pergantian penuh sesuai durasi garansi yang tercantum pada setiap varian (misal: 30 hari hingga 540 hari). Arsip garansi dapat dipantau di portal B-Vault Lisensi.',
            },
            {
              q: 'Apakah bisa memesan di luar jam operasional toko?',
              a: 'Bisa. Pesanan tetap tercatat aman dengan label penjadwalan, dan lisensi Anda akan diprioritaskan oleh tim aktivasi saat jam operasional kembali aktif mulai pukul 08:00 WIB.',
            },
          ].map((item, idx) => {
            const isOpen = expandedFaqIndex === idx;
            return (
              <div key={idx} className="accordion-item">
                <button
                  type="button"
                  className="accordion-trigger"
                  onClick={() => setExpandedFaqIndex(isOpen ? null : idx)}
                >
                  <span>{item.q}</span>
                  <span style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && <div className="accordion-content">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Checkout Modal */}
      {modalOpen && activeVariant && activeProduct && (
        <div className="modal-overlay" onClick={closeCheckout}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--hairline)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                  <h3 className="font-title-lg" style={{ color: 'var(--ink)' }}>
                    CHECKOUT LISENSI B-VAULT
                  </h3>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                  {activeProduct.title} &bull; <strong style={{ color: 'var(--gold-light)' }}>{activeVariant.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                aria-label="Tutup modal"
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)', minHeight: 'auto', minWidth: 'auto', padding: '4px 8px' }}
              >
                &times;
              </button>
            </div>

            {/* Price & Summary Box */}
            <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '16px', borderRadius: 'var(--radius-xs)', marginBottom: '16px', border: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Varian:</span>
                <strong>{activeVariant.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimasi Proses:</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{activeVariant.estimated_delivery_text}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem', color: 'var(--success)' }}>
                  <span>Diskon Kupon Promo:</span>
                  <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Total Pelunasan:</span>
                <div style={{ textAlign: 'right' }}>
                  {discountAmount > 0 && (
                    <span style={{ fontSize: '0.82rem', textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '8px' }}>
                      Rp {activeVariant.retail_price.toLocaleString('id-ID')}
                    </span>
                  )}
                  <strong style={{ fontSize: '1.25rem', color: 'var(--gold-light)' }}>
                    Rp {finalAmount.toLocaleString('id-ID')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Interactive Coupon Tester */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="coupon-input" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Punya Kupon Promo? (Coba: BVAULTHEMAT)
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  id="coupon-input"
                  type="text"
                  placeholder="Masukkan kode kupon..."
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleApplyCoupon}
                  style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                >
                  Terapkan
                </button>
              </div>
              {couponMessage && (
                <span style={{ fontSize: '0.78rem', color: couponApplied ? 'var(--success)' : 'var(--danger)', marginTop: '4px', display: 'block' }}>
                  {couponMessage}
                </span>
              )}
            </div>

            {errorMessage && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.88rem' }}>
                {errorMessage}
              </div>
            )}

            {/* Google Fast Checkout Sync */}
            {authUser ? (
              <div style={{ backgroundColor: 'rgba(219, 177, 99, 0.08)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-xs)', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>
                  Data otomatis terisi via Google: <strong style={{ color: 'var(--gold-light)' }}>{authUser.email}</strong>
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <GoogleAuthButton
                  label="Isi Cepat dengan Akun Google"
                  style={{ width: '100%', padding: '10px', fontSize: '0.86rem' }}
                  onSuccess={(u) => {
                    setAuthUser(u);
                    if (u.name) setName(u.name);
                    if (u.email) setEmail(u.email);
                  }}
                />
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit}>
              {/* 1. Nama Lengkap */}
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
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Untuk verifikasi faktur & nama akun pemesan.
                </span>
              </div>

              {/* 2. Email */}
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
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Faktur dan salinan tautan lisensi dikirim otomatis ke email ini.
                </span>
              </div>

              {/* 3. WhatsApp */}
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
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Untuk konfirmasi darurat dan klaim garansi tim CS.
                </span>
              </div>

              {/* 4. Target Account Input */}
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
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Admin supplier akan mengundang atau mengaktivasi akun sesuai input ini.
                  </span>
                </div>
              )}

              {/* 5. Interactive Payment Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Metode Pembayaran</label>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    { id: 'QRIS', title: 'QRIS Dinamis', desc: 'GoPay, OVO, Dana, ShopeePay, Mobile Banking' },
                    { id: 'BCA_VA', title: 'BCA Virtual Account', desc: 'Verifikasi instan otomatis 24 jam' },
                    { id: 'MANDIRI_VA', title: 'Mandiri Virtual Account', desc: 'Livin by Mandiri & ATM' },
                    { id: 'BNI_VA', title: 'BNI Virtual Account', desc: 'BNI Mobile Banking' },
                    { id: 'BRI_VA', title: 'BRI Virtual Account', desc: 'BRImo & ATM BRI' },
                  ].map((method) => (
                    <div
                      key={method.id}
                      className={`payment-option-card ${paymentMethod === method.id ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <div>
                        <strong style={{ fontSize: '0.9rem', display: 'block' }}>{method.title}</strong>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{method.desc}</span>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>Gratis Admin</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resting Confirmation */}
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
                    Saya mengerti saat ini toko sedang istirahat. Pesanan tetap diproses otomatis saat jam kerja aktif.
                  </label>
                </div>
              )}

              {/* Action Buttons */}
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
                  style={{ flex: 2, fontWeight: 700 }}
                >
                  {submitting ? 'Menyiapkan Pembayaran...' : `Bayar Rp ${finalAmount.toLocaleString('id-ID')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real-time Live Activity Notification Toast */}
      {activities.length > 0 && showToast && activities[activityIndex] && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--accent-gold)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 90,
            maxWidth: '380px',
          }}
        >
          <span className="live-pulse-dot" />
          <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--ink)' }}>
            <strong style={{ color: 'var(--gold-light)', display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Aktivitas Lisensi Terkini
            </strong>
            <span>{activities[activityIndex]}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '2px 4px',
              minHeight: 'auto',
              minWidth: 'auto',
            }}
            aria-label="Tutup notifikasi"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
