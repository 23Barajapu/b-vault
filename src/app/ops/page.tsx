'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GoogleAuthButton from '@/components/GoogleAuthButton';

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

function formatNumberDisplay(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const clean = val.toString().replace(/\D/g, '');
  if (!clean) return '';
  return Number(clean).toLocaleString('id-ID');
}
const formatRupiahDisplay = formatNumberDisplay;

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

  // Tabs: FULFILLMENT | PRODUCTS | ANALYTICS | SETTINGS
  const [activeTab, setActiveTab] = useState<'FULFILLMENT' | 'PRODUCTS' | 'ANALYTICS' | 'SETTINGS'>('FULFILLMENT');

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

  // Products Management State
  const [adminProducts, setAdminProducts] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productMessage, setProductMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modals for Products & Variants
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState({
    title: '',
    platform_name: '',
    category_id: 1,
    slug: '',
    description: '',
    is_active: 1,
  });

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [selectedProductIdForVariant, setSelectedProductIdForVariant] = useState<number | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState<{
    name: string;
    duration_days: number | string;
    cost_price: number | string;
    retail_price: number | string;
    input_requirement_label: string;
    estimated_delivery_text: string;
    warranty_duration_days: number | string;
    activation_guide: string;
    is_active: number;
  }>({
    name: '',
    duration_days: 30,
    cost_price: 0,
    retail_price: 50000,
    input_requirement_label: 'Email Akun Anda',
    estimated_delivery_text: '5 - 20 Menit',
    warranty_duration_days: 30,
    activation_guide: '',
    is_active: 1,
  });

  // Category CRUD State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
  });

  // Settings State
  const [storeStatus, setStoreStatus] = useState('ONLINE');
  const [operatingNotice, setOperatingNotice] = useState('');
  const [adminPhone, setAdminPhone] = useState('085183410190');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Auto-login if session stored in sessionStorage or Google session
  useEffect(() => {
    async function checkExistingAuth() {
      const cachedToken = sessionStorage.getItem('bv_ops_token');
      if (cachedToken) {
        setIsAuthenticated(true);
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
            sessionStorage.setItem('bv_ops_token', 'google_session');
            setIsAuthenticated(true);
          }
        }
      } catch {}
    }
    checkExistingAuth();
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
  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingOrders(true);
      const res = await fetch(`/api/v1/ops/orders/pending?filter=${filter}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
      }
    } catch (err) {
      console.error('Fetch ops orders error', err);
    } finally {
      if (!isSilent) setLoadingOrders(false);
    }
  }, [filter]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingAnalytics(true);
      const res = await fetch('/api/v1/ops/analytics/summary');
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data);
      }
    } catch (err) {
      console.error('Fetch analytics error', err);
    } finally {
      if (!isSilent) setLoadingAnalytics(false);
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

  // Fetch Admin Products
  const fetchAdminProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/v1/ops/products');
      const json = await res.json();
      if (json.success) {
        const sorted = (json.data.products || []).sort((a: any, b: any) =>
          (a.title || '').localeCompare(b.title || '')
        );
        setAdminProducts(sorted);
        setAdminCategories(json.data.categories || []);
      }
    } catch (err) {
      console.error('Fetch admin products error', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Poll orders & products silently
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOrders();
    fetchSettings();
    if (activeTab === 'ANALYTICS') {
      fetchAnalytics();
    }
    if (activeTab === 'PRODUCTS') {
      fetchAdminProducts();
    }
    const interval = setInterval(() => {
      fetchOrders(true);
      if (activeTab === 'ANALYTICS') fetchAnalytics(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchOrders, fetchSettings, fetchAnalytics, fetchAdminProducts, activeTab]);

  // Product Modal Openers
  function handleOpenCreateProduct() {
    setEditingProductId(null);
    setProductForm({
      title: '',
      platform_name: '',
      category_id: adminCategories[0]?.id || 1,
      slug: '',
      description: '',
      is_active: 1,
    });
    setProductModalOpen(true);
  }

  function handleOpenEditProduct(prod: any) {
    setEditingProductId(prod.id);
    setProductForm({
      title: prod.title,
      platform_name: prod.platform_name,
      category_id: prod.category_id,
      slug: prod.slug,
      description: prod.description,
      is_active: prod.is_active,
    });
    setProductModalOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setProductMessage(null);
    try {
      if (editingProductId) {
        // Edit product
        const res = await fetch('/api/v1/ops/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'product',
            id: editingProductId,
            ...productForm,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Produk berhasil diperbarui!', isError: false });
          setProductModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal mengubah produk.', isError: true });
        }
      } else {
        // Create product
        const res = await fetch('/api/v1/ops/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_product',
            ...productForm,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Produk baru berhasil ditambahkan!', isError: false });
          setProductModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal menambah produk.', isError: true });
        }
      }
    } catch {
      setProductMessage({ text: 'Terjadi kesalahan jaringan.', isError: true });
    }
  }

  async function handleDeleteProduct(id: number, title: string) {
    if (!confirm(`Hapus produk "${title}" beserta seluruh variannya?`)) return;
    try {
      const res = await fetch(`/api/v1/ops/products?type=product&id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setProductMessage({ text: `Produk "${title}" berhasil dihapus.`, isError: false });
        fetchAdminProducts();
      } else {
        setProductMessage({ text: json.error?.message || 'Gagal menghapus produk.', isError: true });
      }
    } catch {
      setProductMessage({ text: 'Gagal menghubungi server.', isError: true });
    }
  }

  // Variant Modal Openers
  function handleOpenCreateVariant(productId: number) {
    const parentProd = adminProducts.find((p) => p.id === productId);
    const defaultActive = parentProd ? parentProd.is_active : 1;
    setSelectedProductIdForVariant(productId);
    setEditingVariantId(null);
    setVariantForm({
      name: '',
      duration_days: 30,
      cost_price: 0,
      retail_price: 50000,
      input_requirement_label: 'Email Akun Anda',
      estimated_delivery_text: '5 - 20 Menit',
      warranty_duration_days: 30,
      activation_guide: '1. Pastikan email Anda aktif.\n2. Buka link aktivasi di invoice Anda.',
      is_active: defaultActive,
    });
    setVariantModalOpen(true);
  }

  function handleOpenEditVariant(variant: any) {
    setSelectedProductIdForVariant(variant.product_id);
    setEditingVariantId(variant.id);
    setVariantForm({
      name: variant.name,
      duration_days: variant.duration_days,
      cost_price: variant.cost_price || 0,
      retail_price: variant.retail_price,
      input_requirement_label: variant.input_requirement_label || 'Email Akun Anda',
      estimated_delivery_text: variant.estimated_delivery_text || '5 - 20 Menit',
      warranty_duration_days: variant.warranty_duration_days || variant.duration_days,
      activation_guide: variant.activation_guide || '',
      is_active: variant.is_active,
    });
    setVariantModalOpen(true);
  }

  async function handleSaveVariant(e: React.FormEvent) {
    e.preventDefault();
    setProductMessage(null);
    const cleanRetail = variantForm.retail_price ? Number(variantForm.retail_price.toString().replace(/\D/g, '')) : 0;
    const cleanCost = variantForm.cost_price ? Number(variantForm.cost_price.toString().replace(/\D/g, '')) : 0;
    const cleanDuration = (variantForm.duration_days !== undefined && variantForm.duration_days !== '' && variantForm.duration_days !== null)
      ? Number(variantForm.duration_days.toString().replace(/\D/g, ''))
      : 30;
    const cleanWarranty = (variantForm.warranty_duration_days !== undefined && variantForm.warranty_duration_days !== '' && variantForm.warranty_duration_days !== null)
      ? Number(variantForm.warranty_duration_days.toString().replace(/\D/g, ''))
      : cleanDuration;
    try {
      if (editingVariantId) {
        // Edit variant
        const res = await fetch('/api/v1/ops/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'variant',
            id: editingVariantId,
            ...variantForm,
            duration_days: cleanDuration,
            warranty_duration_days: cleanWarranty,
            retail_price: cleanRetail,
            cost_price: cleanCost,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Varian harga berhasil diperbarui!', isError: false });
          setVariantModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal mengubah varian.', isError: true });
        }
      } else {
        // Create variant
        const res = await fetch('/api/v1/ops/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_variant',
            product_id: selectedProductIdForVariant,
            ...variantForm,
            duration_days: cleanDuration,
            warranty_duration_days: cleanWarranty,
            retail_price: cleanRetail,
            cost_price: cleanCost,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Varian paket baru berhasil ditambahkan!', isError: false });
          setVariantModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal menambah varian.', isError: true });
        }
      }
    } catch {
      setProductMessage({ text: 'Terjadi kesalahan jaringan.', isError: true });
    }
  }

  async function handleDeleteVariant(id: number, name: string) {
    if (!confirm(`Hapus varian paket "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/ops/products?type=variant&id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setProductMessage({ text: `Varian "${name}" berhasil dihapus.`, isError: false });
        fetchAdminProducts();
      } else {
        setProductMessage({ text: json.error?.message || 'Gagal menghapus varian.', isError: true });
      }
    } catch {
      setProductMessage({ text: 'Gagal menghubungi server.', isError: true });
    }
  }

  // Category Modal Handlers
  function handleOpenCreateCategory() {
    setEditingCategoryId(null);
    setCategoryForm({ name: '', slug: '' });
    setCategoryModalOpen(true);
  }

  function handleOpenEditCategory(cat: any) {
    setEditingCategoryId(cat.id);
    setCategoryForm({ name: cat.name, slug: cat.slug });
    setCategoryModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setProductMessage(null);
    try {
      if (editingCategoryId) {
        const res = await fetch('/api/v1/ops/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'category',
            id: editingCategoryId,
            ...categoryForm,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Kategori berhasil diperbarui!', isError: false });
          setCategoryModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal mengubah kategori.', isError: true });
        }
      } else {
        const res = await fetch('/api/v1/ops/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_category',
            ...categoryForm,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setProductMessage({ text: 'Kategori baru berhasil ditambahkan!', isError: false });
          if (json.data?.id) {
            setProductForm((prev) => ({ ...prev, category_id: json.data.id }));
          }
          setCategoryModalOpen(false);
          fetchAdminProducts();
        } else {
          setProductMessage({ text: json.error?.message || 'Gagal membuat kategori.', isError: true });
        }
      }
    } catch {
      setProductMessage({ text: 'Terjadi kesalahan jaringan.', isError: true });
    }
  }

  async function handleDeleteCategory(id: number, name: string) {
    if (!confirm(`Hapus kategori "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/ops/products?type=category&id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setProductMessage({ text: `Kategori "${name}" berhasil dihapus.`, isError: false });
        fetchAdminProducts();
      } else {
        setProductMessage({ text: json.error?.message || 'Gagal menghapus kategori.', isError: true });
      }
    } catch {
      setProductMessage({ text: 'Gagal menghubungi server.', isError: true });
    }
  }

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

            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 16px', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--hairline)' }} />
              <span style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase' }}>atau</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--hairline)' }} />
            </div>

            <GoogleAuthButton
              redirectPath="/ops"
              style={{ width: '100%', padding: '10px' }}
              label="Masuk via Google (Akun Ops)"
              onSuccess={(user) => {
                const uEmail = (user?.email || '').toLowerCase().trim();
                const adminList = ['barajapu23@gmail.com', 'agilezone9@gmail.com', 'ops@b-vault.id', 'admin@b-vault.id'];
                if (user?.role === 'admin' || adminList.includes(uEmail)) {
                  sessionStorage.setItem('bv_ops_token', 'google_session');
                  setIsAuthenticated(true);
                } else {
                  setAuthError(`Akun Google (${user?.email || 'tidak diketahui'}) belum terdaftar sebagai staf Admin Ops.`);
                }
              }}
            />
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
            onClick={() => fetchOrders()}
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
      <div className="scrollable-tabs-nav" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={activeTab === 'FULFILLMENT' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => setActiveTab('FULFILLMENT')}
        >
          Quick Fulfillment ({orders.filter(o => o.payment_status === 'PAID_PROCESSING').length.toLocaleString('id-ID')})
        </button>
        <button
          type="button"
          className={activeTab === 'PRODUCTS' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => { setActiveTab('PRODUCTS'); fetchAdminProducts(); }}
        >
          Katalog Produk & Paket ({adminProducts.length.toLocaleString('id-ID')})
        </button>
        <button
          type="button"
          className={activeTab === 'ANALYTICS' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => { setActiveTab('ANALYTICS'); fetchAnalytics(); }}
        >
          Analitik Keuangan & SLA
        </button>
        <button
          type="button"
          className={activeTab === 'SETTINGS' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => setActiveTab('SETTINGS')}
        >
          Saklar Toko & Kontak
        </button>
      </div>

      {/* TAB 1: QUICK FULFILLMENT */}
      {activeTab === 'FULFILLMENT' && (
        <div>
          {/* Subfilter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={filter === 'PENDING' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setFilter('PENDING')}
              >
                Perlu Diproses
              </button>
              <button
                type="button"
                className={filter === 'FULFILLED' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setFilter('FULFILLED')}
              >
                Riwayat Selesai
              </button>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Polling realtime: tiap 6 detik
            </span>
          </div>

          {(loadingOrders && orders.length === 0) ? (
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
          {(loadingAnalytics && !analytics) ? (
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
                    {Number(analytics.sla_performance.avg_fulfillment_minutes).toLocaleString('id-ID')} Menit
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({Number(analytics.sla_performance.avg_fulfillment_seconds).toLocaleString('id-ID')} detik)
                  </span>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tingkat Kepatuhan SLA</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    {Number(analytics.sla_performance.compliance_rate_percentage).toLocaleString('id-ID')}%
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pesanan diproses &le; 20 menit
                  </span>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pelanggaran SLA (&gt;20m)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: analytics.sla_performance.breached_count > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {Number(analytics.sla_performance.breached_count).toLocaleString('id-ID')} Pesanan
                  </div>
                </div>
              </div>

              {/* Volume Status Pesanan Toko */}
              {analytics.orders && (
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
                    Volume Status Pesanan (Total Realtime)
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <div className="card" style={{ padding: '14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Lunas & Selesai</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--success)' }}>
                        {Number(analytics.orders.fulfilled || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="card" style={{ padding: '14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Perlu Diproses</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--warning)' }}>
                        {Number(analytics.orders.pending_fulfillment || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="card" style={{ padding: '14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Menunggu Bayar</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>
                        {Number(analytics.orders.pending_payment || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="card" style={{ padding: '14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Kadaluarsa</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--muted)' }}>
                        {Number(analytics.orders.expired || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="card" style={{ padding: '14px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Di-refund</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--danger)' }}>
                        {Number(analytics.orders.refunded || 0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
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

      {/* TAB 4: PRODUCTS & PRICING MANAGEMENT */}
      {activeTab === 'PRODUCTS' && (
        <div>
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="font-title-lg" style={{ color: 'var(--ink)' }}>Manajemen Produk & Harga</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                Tambah produk baru, atur varian paket durasi, ubah harga jual secara fleksibel, dan tentukan panduan aktivasi.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchAdminProducts}
                style={{ padding: '8px 14px', fontSize: '0.84rem' }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenCreateCategory}
                style={{ padding: '8px 14px', fontSize: '0.84rem', borderColor: 'var(--accent-gold)', color: 'var(--gold-light)' }}
              >
                📁 Kelola Kategori ({adminCategories.length})
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenCreateProduct}
                style={{ padding: '8px 16px', fontSize: '0.84rem', fontWeight: 700 }}
              >
                + Tambah Produk Baru
              </button>
            </div>
          </div>

          {/* Feedback Message */}
          {productMessage && (
            <div style={{
              backgroundColor: productMessage.isError ? 'var(--danger-bg)' : 'var(--success-bg)',
              border: `1px solid ${productMessage.isError ? 'var(--danger-border)' : 'var(--success-border)'}`,
              color: productMessage.isError ? 'var(--danger)' : 'var(--success)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.88rem'
            }}>
              {productMessage.text}
            </div>
          )}

          {/* Product List */}
          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
              <span className="live-pulse-dot" style={{ marginRight: '8px' }} />
              <span>Memuat data produk dari database...</span>
            </div>
          ) : adminProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <h3 className="font-title-lg" style={{ color: 'var(--gold-light)', marginBottom: '8px' }}>
                Katalog Produk Masih Kosong
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--body)', maxWidth: '480px', margin: '0 auto 16px' }}>
                Belum ada produk terdaftar di database. Anda dapat menambahkan produk pertama secara fleksibel menggunakan tombol di bawah.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenCreateProduct}
                style={{ padding: '10px 20px', fontWeight: 700 }}
              >
                + Tambah Produk Pertama Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {adminProducts.map((prod) => (
                <div key={prod.id} className="card" style={{ padding: '20px' }}>
                  {/* Product Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>{prod.platform_name}</span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{prod.category_name || 'Umum'}</span>
                        {prod.is_active === 1 ? (
                          <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>Aktif</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Non-Aktif</span>
                        )}
                      </div>
                      <h3 className="font-title-lg" style={{ color: 'var(--ink)', fontSize: '1.15rem' }}>{prod.title}</h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>{prod.description}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleOpenCreateVariant(prod.id)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--accent-gold)', color: 'var(--gold-light)', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        + Varian Paket
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleOpenEditProduct(prod)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDeleteProduct(prod.id, prod.title)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  {/* Variants List Table */}
                  {prod.variants && prod.variants.length > 0 ? (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: '540px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--hairline)', textAlign: 'left', color: 'var(--muted)' }}>
                            <th style={{ padding: '8px' }}>Nama Varian Paket</th>
                            <th style={{ padding: '8px' }}>Durasi</th>
                            <th style={{ padding: '8px' }}>Modal</th>
                            <th style={{ padding: '8px' }}>Harga Jual</th>
                            <th style={{ padding: '8px' }}>Garansi</th>
                            <th style={{ padding: '8px' }}>Status Paket</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prod.variants.map((v: any) => (
                            <tr key={v.id} style={{ borderBottom: '1px solid rgba(219, 177, 99, 0.1)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--ink)' }}>
                                {v.name}
                              </td>
                              <td style={{ padding: '10px 8px', color: 'var(--body)' }}>
                                {Number(v.duration_days) === 0 || Number(v.duration_days) >= 9999 ? (
                                  <span className="badge badge-online" style={{ fontSize: '0.72rem' }}>✦ Lifetime</span>
                                ) : (
                                  `${Number(v.duration_days).toLocaleString('id-ID')} Hari`
                                )}
                              </td>
                              <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                                Rp {Number(v.cost_price || 0).toLocaleString('id-ID')}
                              </td>
                              <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--gold-light)' }}>
                                Rp {Number(v.retail_price).toLocaleString('id-ID')}
                              </td>
                              <td style={{ padding: '10px 8px', color: 'var(--body)' }}>
                                {Number(v.warranty_duration_days) === 0 || Number(v.warranty_duration_days) >= 9999 ? (
                                  <span className="badge badge-online" style={{ fontSize: '0.72rem' }}>✦ Garansi Lifetime</span>
                                ) : (
                                  `${Number(v.warranty_duration_days).toLocaleString('id-ID')} Hari`
                                )}
                              </td>
                              <td style={{ padding: '10px 8px' }}>
                                {v.is_active === 1 && prod.is_active === 1 ? (
                                  <span className="badge badge-online" style={{ fontSize: '0.72rem' }}>
                                    Aktif
                                  </span>
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                                    {prod.is_active === 0 ? 'Non-Aktif (Ikut Produk)' : 'Non-Aktif'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => handleOpenEditVariant(v)}
                                  style={{ padding: '4px 8px', fontSize: '0.78rem', minHeight: 'auto', marginRight: '6px' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => handleDeleteVariant(v.id, v.name)}
                                  style={{ padding: '4px 8px', fontSize: '0.78rem', minHeight: 'auto' }}
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-xs)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Belum ada paket/varian harga untuk produk ini.{' '}
                      <button
                        type="button"
                        onClick={() => handleOpenCreateVariant(prod.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                      >
                        + Tambah Varian Pertama
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT PRODUK INDUK */}
      {productModalOpen && (
        <div className="modal-overlay" onClick={() => setProductModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--hairline)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '0.95rem' }}>✦</span>
                <h3 className="font-title-lg" style={{ color: 'var(--ink)' }}>
                  {editingProductId ? 'Edit Produk' : 'Tambah Produk Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                aria-label="Tutup modal"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.35rem', cursor: 'pointer', padding: '4px', minHeight: 'auto', minWidth: 'auto', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">
                    Nama Produk <span style={{ color: 'var(--accent-gold)' }}>*</span>
                  </label>
                  <span className="modal-label-hint">Contoh: Google AI Pro</span>
                </div>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="Contoh: Google AI Pro"
                />
              </div>

              <div className="modal-form-row">
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">
                      Platform / Vendor <span style={{ color: 'var(--accent-gold)' }}>*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={productForm.platform_name}
                    onChange={(e) => setProductForm({ ...productForm, platform_name: e.target.value })}
                    placeholder="Contoh: Google, Canva, Adobe"
                  />
                </div>
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">
                      Kategori <span style={{ color: 'var(--accent-gold)' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenCreateCategory}
                      className="modal-inline-action"
                    >
                      + Kategori Baru
                    </button>
                  </div>
                  <select
                    required
                    value={productForm.category_id || (adminCategories[0]?.id || '')}
                    onChange={(e) => setProductForm({ ...productForm, category_id: Number(e.target.value) })}
                  >
                    {adminCategories.length === 0 ? (
                      <option value="">(Klik + Kategori Baru di atas)</option>
                    ) : (
                      adminCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">Slug URL</label>
                  <span className="modal-label-hint">Opsional, otomatis dibuat jika kosong</span>
                </div>
                <input
                  type="text"
                  value={productForm.slug}
                  onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                  placeholder="contoh: google-ai-pro"
                />
              </div>

              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">Deskripsi Singkat</label>
                  <span className="modal-label-hint">Ringkasan keuntungan & fitur utama</span>
                </div>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Deskripsikan keuntungan, kapasitas cloud, atau fitur utama..."
                />
              </div>

              <div className="modal-form-group" style={{ marginBottom: '22px' }}>
                <div className="modal-label-header">
                  <label className="modal-label">Status Publikasi</label>
                </div>
                <select
                  value={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: Number(e.target.value) })}
                >
                  <option value={1}>Aktif (Tampil di Katalog Toko)</option>
                  <option value={0}>Non-Aktif (Disembunyikan)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--hairline)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setProductModalOpen(false)}
                  style={{ minHeight: '40px', height: '40px', padding: '0 18px', fontSize: '0.88rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: '40px', height: '40px', padding: '0 20px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  {editingProductId ? 'Simpan Perubahan' : 'Buat Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT VARIAN PAKET & HARGA */}
      {variantModalOpen && (
        <div className="modal-overlay" onClick={() => setVariantModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--hairline)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '0.95rem' }}>✦</span>
                <h3 className="font-title-lg" style={{ color: 'var(--ink)' }}>
                  {editingVariantId ? 'Edit Varian Paket' : 'Tambah Varian Paket Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalOpen(false)}
                aria-label="Tutup modal"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.35rem', cursor: 'pointer', padding: '4px', minHeight: 'auto', minWidth: 'auto', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveVariant}>
              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">
                    Nama Paket Varian <span style={{ color: 'var(--accent-gold)' }}>*</span>
                  </label>
                  <span className="modal-label-hint">Contoh: 1 Bulan Private / 1 Tahun Sharing</span>
                </div>
                <input
                  type="text"
                  required
                  value={variantForm.name}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  placeholder="Contoh: 1 Bulan Private Access"
                />
              </div>

              <div className="modal-form-row">
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">
                      Durasi Aktif (Hari) <span style={{ color: 'var(--accent-gold)' }}>*</span>
                    </label>
                    <button
                      type="button"
                      className="modal-inline-action"
                      style={{
                        color: Number(variantForm.duration_days) === 0 ? 'var(--gold-light)' : 'var(--muted)',
                        fontWeight: Number(variantForm.duration_days) === 0 ? 700 : 500
                      }}
                      onClick={() => {
                        setVariantForm({
                          ...variantForm,
                          duration_days: Number(variantForm.duration_days) === 0 ? 30 : 0
                        });
                      }}
                    >
                      {Number(variantForm.duration_days) === 0 ? '✓ Mode Lifetime' : '+ Set Lifetime'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={Number(variantForm.duration_days) === 0 ? '0 (Lifetime / Selamanya)' : formatNumberDisplay(variantForm.duration_days)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setVariantForm({ ...variantForm, duration_days: clean !== '' ? Number(clean) : '' });
                    }}
                    placeholder="30 atau 0 untuk Lifetime"
                    style={{
                      borderColor: Number(variantForm.duration_days) === 0 ? 'var(--accent-gold)' : undefined,
                      color: Number(variantForm.duration_days) === 0 ? 'var(--gold-light)' : undefined,
                      fontWeight: Number(variantForm.duration_days) === 0 ? 700 : undefined,
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 30 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px' }}
                    >
                      30 Hari
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 365 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px' }}
                    >
                      1 Tahun (365)
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 0 })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px', fontWeight: 600 }}
                    >
                      ✦ Lifetime / Unlimited
                    </button>
                  </div>
                </div>

                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">
                      Garansi (Hari) <span style={{ color: 'var(--accent-gold)' }}>*</span>
                    </label>
                    <button
                      type="button"
                      className="modal-inline-action"
                      style={{
                        color: Number(variantForm.warranty_duration_days) === 0 ? 'var(--gold-light)' : 'var(--muted)',
                        fontWeight: Number(variantForm.warranty_duration_days) === 0 ? 700 : 500
                      }}
                      onClick={() => {
                        setVariantForm({
                          ...variantForm,
                          warranty_duration_days: Number(variantForm.warranty_duration_days) === 0 ? 30 : 0
                        });
                      }}
                    >
                      {Number(variantForm.warranty_duration_days) === 0 ? '✓ Garansi Lifetime' : '+ Set Lifetime'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={Number(variantForm.warranty_duration_days) === 0 ? '0 (Garansi Selamanya)' : formatNumberDisplay(variantForm.warranty_duration_days)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setVariantForm({ ...variantForm, warranty_duration_days: clean !== '' ? Number(clean) : '' });
                    }}
                    placeholder="30 atau 0 untuk Lifetime"
                    style={{
                      borderColor: Number(variantForm.warranty_duration_days) === 0 ? 'var(--accent-gold)' : undefined,
                      color: Number(variantForm.warranty_duration_days) === 0 ? 'var(--gold-light)' : undefined,
                      fontWeight: Number(variantForm.warranty_duration_days) === 0 ? 700 : undefined,
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 30 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px' }}
                    >
                      30 Hari
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 365 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px' }}
                    >
                      1 Tahun (365)
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 0 })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 4px', fontWeight: 600 }}
                    >
                      ✦ Garansi Lifetime
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-form-row">
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">Harga Modal / Supplier (Rp)</label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberDisplay(variantForm.cost_price)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setVariantForm({ ...variantForm, cost_price: clean ? Number(clean) : '' });
                    }}
                    placeholder="Contoh: 25.000"
                  />
                </div>
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label" style={{ color: 'var(--gold-light)' }}>
                      Harga Jual Retail (Rp) <span style={{ color: 'var(--accent-gold)' }}>*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatNumberDisplay(variantForm.retail_price)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setVariantForm({ ...variantForm, retail_price: clean ? Number(clean) : '' });
                    }}
                    placeholder="Contoh: 45.000"
                  />
                </div>
              </div>

              {/* Estimasi Laba Bersih per Unit */}
              <div style={{
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-xs)',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.84rem'
              }}>
                <span style={{ color: 'var(--muted)' }}>Estimasi Margin Keuntungan / Unit:</span>
                <strong style={{
                  color: (Number(variantForm.retail_price || 0) - Number(variantForm.cost_price || 0)) >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  Rp {(Number(variantForm.retail_price || 0) - Number(variantForm.cost_price || 0)).toLocaleString('id-ID')}
                </strong>
              </div>

              <div className="modal-form-row">
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">Label Input Pembeli</label>
                  </div>
                  <input
                    type="text"
                    value={variantForm.input_requirement_label}
                    onChange={(e) => setVariantForm({ ...variantForm, input_requirement_label: e.target.value })}
                    placeholder="Contoh: Email Akun Anda"
                  />
                </div>
                <div>
                  <div className="modal-label-header">
                    <label className="modal-label">Estimasi Pengiriman</label>
                  </div>
                  <input
                    type="text"
                    value={variantForm.estimated_delivery_text}
                    onChange={(e) => setVariantForm({ ...variantForm, estimated_delivery_text: e.target.value })}
                    placeholder="5 - 20 Menit"
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">Panduan Aktivasi untuk Pembeli</label>
                  <span className="modal-label-hint">Langkah yang diterima pembeli di invoice</span>
                </div>
                <textarea
                  rows={3}
                  value={variantForm.activation_guide}
                  onChange={(e) => setVariantForm({ ...variantForm, activation_guide: e.target.value })}
                  placeholder="Langkah 1. Cek email masuk dari team invite...&#10;Langkah 2. Klik terima undangan..."
                />
              </div>

              <div className="modal-form-group" style={{ marginBottom: '22px' }}>
                <div className="modal-label-header">
                  <label className="modal-label">Status Varian</label>
                  {adminProducts.find((p) => p.id === selectedProductIdForVariant)?.is_active === 0 && (
                    <span className="modal-label-hint" style={{ color: 'var(--warning)' }}>
                      ⚠️ Produk induk Non-Aktif
                    </span>
                  )}
                </div>
                <select
                  value={variantForm.is_active}
                  onChange={(e) => setVariantForm({ ...variantForm, is_active: Number(e.target.value) })}
                >
                  <option value={1}>Aktif (Bisa dibeli jika produk aktif)</option>
                  <option value={0}>Non-Aktif (Stok Kosong / Disembunyikan)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--hairline)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setVariantModalOpen(false)}
                  style={{ minHeight: '40px', height: '40px', padding: '0 18px', fontSize: '0.88rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: '40px', height: '40px', padding: '0 20px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  {editingVariantId ? 'Simpan Varian' : 'Tambahkan Varian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KELOLA KATEGORI (CRUD) */}
      {categoryModalOpen && (
        <div className="modal-overlay" onClick={() => setCategoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--hairline)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-gold)', fontSize: '0.95rem' }}>✦</span>
                <h3 className="font-title-lg" style={{ color: 'var(--ink)' }}>
                  {editingCategoryId ? 'Edit Kategori' : 'Kelola Kategori Produk'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                aria-label="Tutup modal"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.35rem', cursor: 'pointer', padding: '4px', minHeight: 'auto', minWidth: 'auto', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Form Tambah / Edit Kategori */}
            <form onSubmit={handleSaveCategory} style={{ backgroundColor: 'var(--surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', marginBottom: '20px' }}>
              <div className="modal-label-header" style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--gold-light)' }}>
                  {editingCategoryId ? 'Form Perbarui Kategori' : '+ Tambah Kategori Baru'}
                </strong>
              </div>

              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">
                    Nama Kategori <span style={{ color: 'var(--accent-gold)' }}>*</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Contoh: AI & Machine Learning"
                />
              </div>

              <div className="modal-form-group">
                <div className="modal-label-header">
                  <label className="modal-label">Slug URL</label>
                  <span className="modal-label-hint">Opsional, otomatis dibuat</span>
                </div>
                <input
                  type="text"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  placeholder="contoh: ai-machine-learning"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
                {editingCategoryId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setEditingCategoryId(null); setCategoryForm({ name: '', slug: '' }); }}
                    style={{ minHeight: '34px', height: '34px', padding: '0 14px', fontSize: '0.82rem' }}
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: '34px', height: '34px', padding: '0 16px', fontSize: '0.84rem', fontWeight: 700 }}
                >
                  {editingCategoryId ? 'Simpan Perubahan' : '+ Simpan Kategori'}
                </button>
              </div>
            </form>

            {/* Daftar Kategori Terdaftar */}
            <div>
              <span className="font-label-uppercase" style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                Daftar Kategori Terdaftar ({adminCategories.length}):
              </span>

              {adminCategories.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center', padding: '16px' }}>
                  Belum ada kategori di database. Gunakan form di atas untuk membuat kategori pertama.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {adminCategories.map((cat) => (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        backgroundColor: 'var(--surface-card)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 'var(--radius-xs)'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>{cat.name}</strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block' }}>/{cat.slug}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleOpenEditCategory(cat)}
                          style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 'auto' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 'auto' }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
