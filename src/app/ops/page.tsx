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
  expired_at?: string | null;
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
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PENDING' | 'FULFILLED'>('ALL');
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
  const [adminPhone, setAdminPhone] = useState('085861708659');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [baselineLicenses, setBaselineLicenses] = useState<number | string>(50);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Parameter Sistem Tambahan
  // 1. User & Sesi
  const [sessionIdleMins, setSessionIdleMins] = useState<number | string>(5);
  const [sessionMaxHours, setSessionMaxHours] = useState<number | string>(8);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState<number | string>(5);

  // 2. Kalender & Libur
  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayDates, setHolidayDates] = useState('');
  const [holidayNotice, setHolidayNotice] = useState('Toko sedang libur operasional. Seluruh pesanan akan diproses kembali saat toko buka.');
  const [opHoursStart, setOpHoursStart] = useState('08:00');
  const [opHoursEnd, setOpHoursEnd] = useState('23:00');

  // 3. Transaksi & SLA
  const [paymentExpiryMins, setPaymentExpiryMins] = useState<number | string>(10);
  const [verifyWindowHours, setVerifyWindowHours] = useState<number | string>(24);
  const [slaTargetMins, setSlaTargetMins] = useState<number | string>(15);
  const [slaBreachMins, setSlaBreachMins] = useState<number | string>(20);

  // 4. Promo, Kupon & Banner Diskon
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [promoCode, setPromoCode] = useState('BVAULTHEMAT');
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number | string>(10);
  const [promoMinOrderAmount, setPromoMinOrderAmount] = useState<number | string>(0);
  const [promoBannerActive, setPromoBannerActive] = useState(true);
  const [promoBannerText, setPromoBannerText] = useState('🔥 Promo Spesial: Gunakan kode kupon BVAULTHEMAT untuk diskon 10% semua lisensi pro resmi!');

  // 5. Coupon CRUD State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'PERCENT',
    discount_value: 10 as number | string,
    min_order_amount: 0 as number | string,
    max_discount_amount: '' as number | string,
    is_active: true,
    notes: '',
  });
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [mounted, setMounted] = useState(false);

  // Auto-login if session stored in sessionStorage or Google session
  useEffect(() => {
    setMounted(true);
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
      if (!res.ok) {
        if (!isSilent) console.warn('Fetch ops orders status:', res.status);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
      }
    } catch (err: any) {
      if (!isSilent) console.warn('Fetch ops orders notice:', err?.message || err);
    } finally {
      if (!isSilent) setLoadingOrders(false);
    }
  }, [filter]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingAnalytics(true);
      const res = await fetch('/api/v1/ops/analytics/summary');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data);
      }
    } catch (err: any) {
      if (!isSilent) console.warn('Fetch analytics notice:', err?.message || err);
    } finally {
      if (!isSilent) setLoadingAnalytics(false);
    }
  }, []);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ops/settings/store-status');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setStoreStatus(d.store_status || 'ONLINE');
        setOperatingNotice(d.operating_hours_notice || '');
        setAdminPhone(d.admin_whatsapp || '085861708659');
        setTgToken(d.telegram_bot_token || '');
        setTgChatId(d.telegram_chat_id || '');
        setBaselineLicenses(d.baseline_delivered_licenses || 50);

        setSessionIdleMins(d.session_idle_timeout_minutes ?? 5);
        setSessionMaxHours(d.session_max_lifetime_hours ?? 8);
        setMaxLoginAttempts(d.max_login_attempts ?? 5);

        setHolidayMode(Boolean(d.holiday_mode));
        setHolidayDates(d.holiday_dates || '');
        setHolidayNotice(d.holiday_notice || '');
        setOpHoursStart(d.operating_hours_start || '08:00');
        setOpHoursEnd(d.operating_hours_end || '23:00');

        setPaymentExpiryMins(d.payment_expiry_minutes ?? 10);
        setVerifyWindowHours(d.verification_window_hours ?? 24);
        setSlaTargetMins(d.sla_target_minutes ?? 15);
        setSlaBreachMins(d.sla_breach_minutes ?? 20);

        setPromoEnabled(d.promo_enabled !== undefined ? Boolean(d.promo_enabled) : true);
        setPromoCode(d.promo_code || 'BVAULTHEMAT');
        setPromoDiscountPercent(d.promo_discount_percent ?? 10);
        setPromoMinOrderAmount(d.promo_min_order_amount ?? 0);
        setPromoBannerActive(d.promo_banner_active !== undefined ? Boolean(d.promo_banner_active) : true);
        setPromoBannerText(d.promo_banner_text || '🔥 Promo Spesial: Gunakan kode kupon BVAULTHEMAT untuk diskon 10% semua lisensi pro resmi!');

        if (Array.isArray(d.promo_coupons)) {
          setCoupons(d.promo_coupons);
        }
      }
    } catch (err: any) {
      console.warn('Fetch settings notice:', err?.message || err);
    }
  }, []);

  // Fetch Admin Products
  const fetchAdminProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/v1/ops/products');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        const sorted = (json.data.products || []).sort((a: any, b: any) =>
          (a.title || '').localeCompare(b.title || '')
        );
        setAdminProducts(sorted);
        setAdminCategories(json.data.categories || []);
      }
    } catch (err: any) {
      console.warn('Fetch admin products notice:', err?.message || err);
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
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders(true);
        if (activeTab === 'ANALYTICS') fetchAnalytics(true);
      }
    }, 8000);
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

  // Handle Confirm Payment (Tandai Lunas oleh Admin)
  async function handleConfirmPayment(orderId: number) {
    try {
      const res = await fetch(`/api/v1/ops/orders/${orderId}/confirm-payment`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setFulfillMessage({ id: orderId, text: 'Pembayaran berhasil diverifikasi Lunas!', isError: false });
        fetchOrders(true);
        fetchAnalytics(true);
      } else {
        setFulfillMessage({ id: orderId, text: json.error?.message || 'Gagal verifikasi pembayaran.', isError: true });
      }
    } catch {
      setFulfillMessage({ id: orderId, text: 'Kesalahan jaringan saat memverifikasi pembayaran.', isError: true });
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
          baseline_delivered_licenses: String(baselineLicenses || 50),

          // User & Sesi
          session_idle_timeout_minutes: Number(sessionIdleMins) || 5,
          session_max_lifetime_hours: Number(sessionMaxHours) || 8,
          max_login_attempts: Number(maxLoginAttempts) || 5,

          // Kalender & Libur
          holiday_mode: holidayMode ? 'true' : 'false',
          holiday_dates: holidayDates,
          holiday_notice: holidayNotice,
          operating_hours_start: opHoursStart,
          operating_hours_end: opHoursEnd,

          // Transaksi & SLA
          payment_expiry_minutes: Number(paymentExpiryMins) || 10,
          verification_window_hours: Number(verifyWindowHours) || 24,
          sla_target_minutes: Number(slaTargetMins) || 15,
          sla_breach_minutes: Number(slaBreachMins) || 20,

          // Promo, Kupon & Banner Diskon
          promo_enabled: promoEnabled ? 'true' : 'false',
          promo_code: promoCode.trim().toUpperCase() || 'BVAULTHEMAT',
          promo_discount_percent: Number(promoDiscountPercent) || 10,
          promo_min_order_amount: Number(promoMinOrderAmount) || 0,
          promo_banner_active: promoBannerActive ? 'true' : 'false',
          promo_banner_text: promoBannerText.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSettingsMessage('Seluruh parameter sistem berhasil diperbarui.');
      } else {
        setSettingsMessage(json.error?.message || 'Gagal menyimpan pengaturan.');
      }
    } catch {
      setSettingsMessage('Kesalahan koneksi saat menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  }

  // Coupon CRUD Handlers
  function handleOpenCreateCoupon() {
    setEditingCouponId(null);
    setCouponForm({
      code: '',
      discount_type: 'PERCENT',
      discount_value: 10,
      min_order_amount: 0,
      max_discount_amount: '',
      is_active: true,
      notes: '',
    });
    setCouponMessage(null);
    setCouponModalOpen(true);
  }

  function handleOpenEditCoupon(item: any) {
    setEditingCouponId(item.id);
    setCouponForm({
      code: item.code,
      discount_type: item.discount_type || 'PERCENT',
      discount_value: item.discount_value,
      min_order_amount: item.min_order_amount || 0,
      max_discount_amount: item.max_discount_amount || '',
      is_active: item.is_active !== undefined ? item.is_active : true,
      notes: item.notes || '',
    });
    setCouponMessage(null);
    setCouponModalOpen(true);
  }

  async function handleSaveCoupon(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = couponForm.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      setCouponMessage({ text: 'Kode kupon wajib diisi.', isError: true });
      return;
    }

    try {
      setCouponLoading(true);
      setCouponMessage(null);
      const res = await fetch('/api/v1/ops/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT',
          coupon: {
            id: editingCouponId || undefined,
            code: cleanCode,
            discount_type: couponForm.discount_type,
            discount_value: Number(couponForm.discount_value) || 10,
            min_order_amount: Number(couponForm.min_order_amount) || 0,
            max_discount_amount: couponForm.max_discount_amount ? Number(couponForm.max_discount_amount) : null,
            is_active: Boolean(couponForm.is_active),
            notes: couponForm.notes,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.coupons) {
        setCoupons(json.data.coupons);
        setCouponModalOpen(false);
      } else {
        setCouponMessage({ text: json.error?.message || 'Gagal menyimpan kupon.', isError: true });
      }
    } catch {
      setCouponMessage({ text: 'Kesalahan jaringan saat menyimpan kupon.', isError: true });
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleDeleteCoupon(id: string, code: string) {
    if (!confirm(`Hapus kupon promo ${code} secara permanen?`)) return;
    try {
      const res = await fetch('/api/v1/ops/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', id }),
      });
      const json = await res.json();
      if (json.success && json.data?.coupons) {
        setCoupons(json.data.coupons);
      }
    } catch (err) {
      console.warn('Gagal menghapus kupon', err);
    }
  }

  async function handleToggleCoupon(id: string) {
    try {
      const res = await fetch('/api/v1/ops/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE', id }),
      });
      const json = await res.json();
      if (json.success && json.data?.coupons) {
        setCoupons(json.data.coupons);
      }
    } catch (err) {
      console.warn('Gagal mengubah status kupon', err);
    }
  }

  // 1-Tap Copy
  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedTarget(id);
    setTimeout(() => setCopiedTarget(null), 2000);
  }

  // 0. Mounting Gate (prevents SSR hydration mismatch from browser extensions & storage checks)
  if (!mounted) {
    return (
      <div className="container" style={{ maxWidth: '440px', paddingTop: '120px', textAlign: 'center' }} suppressHydrationWarning>
        <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Memverifikasi otentikasi Ops Desk...</div>
      </div>
    );
  }

  // 1. Unauthenticated Login Gate
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ maxWidth: '440px', paddingTop: '80px' }} suppressHydrationWarning>
        <div className="card" style={{ padding: '32px 24px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }} suppressHydrationWarning>
          <div style={{ textAlign: 'center', marginBottom: '24px' }} suppressHydrationWarning>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', marginBottom: '12px' }} suppressHydrationWarning>
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
          Pesanan & Pemenuhan ({orders.length.toLocaleString('id-ID')})
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
          Pemeliharaan Parameter Sistem
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
                className={filter === 'ALL' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setFilter('ALL')}
              >
                Semua Pesanan
              </button>
              <button
                type="button"
                className={filter === 'UNPAID' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setFilter('UNPAID')}
              >
                Menunggu Bayar
              </button>
              <button
                type="button"
                className={filter === 'PENDING' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => setFilter('PENDING')}
              >
                Perlu Lisensi (Lunas)
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
                Pesanan dari pembeli akan otomatis muncul di antrean ini.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order) => {
                const createdAtMs = new Date(order.created_at).getTime();
                const is24HoursExpired = (Date.now() - createdAtMs) > 24 * 60 * 60 * 1000;
                const isPaidProcessing = order.payment_status === 'PAID_PROCESSING';
                const isFulfilled = order.payment_status === 'FULFILLED';
                const isExpired = order.payment_status === 'EXPIRED' || (is24HoursExpired && !isPaidProcessing && !isFulfilled);
                const isPaymentTimeExpired = order.expired_at ? new Date(order.expired_at).getTime() < Date.now() : false;
                const isAwaitingVerification = !isExpired && !isPaidProcessing && !isFulfilled && (
                  order.payment_status === 'AWAITING_VERIFICATION' || (order.payment_status === 'PENDING_PAYMENT' && isPaymentTimeExpired)
                );
                const isPendingPayment = order.payment_status === 'PENDING_PAYMENT' && !isPaymentTimeExpired && !isExpired;

                const remainingVerificationMs = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - createdAtMs));
                const remainingHours = Math.floor(remainingVerificationMs / (60 * 60 * 1000));
                const remainingMins = Math.floor((remainingVerificationMs % (60 * 60 * 1000)) / (60 * 1000));

                const inputState = fulfillInputs[order.id] || { payload: '', notes: '', loading: false };
                const msg = fulfillMessage?.id === order.id ? fulfillMessage : null;

                const borderLeftColor = isPaidProcessing
                  ? (order.is_sla_breached ? '5px solid var(--danger)' : '5px solid var(--warning)')
                  : isPendingPayment
                  ? '5px solid var(--gold-light)'
                  : isAwaitingVerification
                  ? '5px solid var(--warning)'
                  : isFulfilled
                  ? '5px solid var(--success)'
                  : '5px solid var(--muted)';

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      borderLeft: borderLeftColor,
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
                          <span className={`badge ${
                            isPaidProcessing
                              ? (order.is_sla_breached ? 'badge-danger' : 'badge-warning')
                              : isPendingPayment
                              ? 'badge-warning'
                              : isAwaitingVerification
                              ? 'badge-warning'
                              : isFulfilled
                              ? 'badge-online'
                              : 'badge-danger'
                          }`}>
                            {isPaidProcessing
                              ? (order.is_sla_breached ? 'SLA LEWAT (>20m)' : 'LUNAS - PERLU LINK')
                              : isPendingPayment
                              ? 'MENUNGGU BAYAR (0-10m)'
                              : isAwaitingVerification
                              ? 'VERIFIKASI MANUAL (24J)'
                              : isFulfilled
                              ? 'SELESAI'
                              : isExpired
                              ? 'KADALUARSA'
                              : order.payment_status}
                          </span>
                          {order.supplier_issue && (
                            <span className="badge badge-warning" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                              Kendala Supplier Aktif
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Metode: {order.payment_method} &bull; Total: Rp {Number(order.total_amount).toLocaleString('id-ID')} &bull; Dibuat: {new Date(order.created_at).toLocaleString('id-ID')}
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

                    {/* If Pending Payment or Awaiting Verification: Tombol Verifikasi Pembayaran Lunas */}
                    {(isPendingPayment || isAwaitingVerification) && (
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                            {isAwaitingVerification
                              ? `QRIS 10m berakhir. Sisa batas verifikasi: ${remainingHours}j ${remainingMins}m. Klik setelah cek mutasi/WA.`
                              : 'Pembeli dalam batas pembayaran 10 menit. Klik setelah cek mutasi/WA jika transfer manual.'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ backgroundColor: '#25D366', borderColor: '#25D366', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
                            onClick={() => handleConfirmPayment(order.id)}
                          >
                            Tandai Lunas (Verifikasi Pembayaran)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* If Expired: Keterangan Pesanan Kadaluarsa */}
                    {isExpired && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        <div style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: 'var(--danger)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>⚠️</span>
                          <span>Pesanan telah kadaluarsa lebih dari 24 jam. Pembayaran tidak dapat ditandai lunas.</span>
                        </div>
                      </div>
                    )}

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
                    {isFulfilled && (
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

      {/* TAB 3: PEMELIHARAAN PARAMETER SISTEM */}
      {activeTab === 'SETTINGS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="font-title-lg" style={{ color: 'var(--ink)' }}>Pemeliharaan Parameter Sistem</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                Konfigurasi terpusat untuk keamanan sesi, kalender hari libur, jam operasional toko, batas transaksi, dan integrasi bot.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchSettings}
              style={{ padding: '8px 14px', fontSize: '0.84rem' }}
            >
              Refresh Parameter
            </button>
          </div>

          {settingsMessage && (
            <div style={{
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              border: '1px solid var(--success-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓</span>
              <span>{settingsMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* KARTU 1: USER & KEAMANAN SESI */}
              <div className="card" style={{ padding: '20px', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Parameter Sesi & Keamanan</h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Pengendalian sesi aktif dan login timeout</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-idle">Timeout Inaktivitas Sesi (Menit)</label>
                  <input
                    id="ops-param-idle"
                    type="number"
                    min="1"
                    max="60"
                    value={sessionIdleMins}
                    onChange={(e) => setSessionIdleMins(e.target.value)}
                    placeholder="5"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Otomatis logout jika user/admin tidak bergerak (default: 5 menit).
                  </span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-session-max">Masa Berlaku Token Login (Jam)</label>
                  <input
                    id="ops-param-session-max"
                    type="number"
                    min="1"
                    max="72"
                    value={sessionMaxHours}
                    onChange={(e) => setSessionMaxHours(e.target.value)}
                    placeholder="8"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Durasi token sesi admin berlaku sebelum wajib re-login (default: 8 jam).
                  </span>
                </div>

                <div>
                  <label htmlFor="ops-param-login-attempts">Batas Percobaan Login Salah</label>
                  <input
                    id="ops-param-login-attempts"
                    type="number"
                    min="3"
                    max="10"
                    value={maxLoginAttempts}
                    onChange={(e) => setMaxLoginAttempts(e.target.value)}
                    placeholder="5"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Batas toleransi salah password/PIN sebelum cooldown pengamanan.
                  </span>
                </div>
              </div>

              {/* KARTU 2: KALENDER & HARI LIBUR */}
              <div className="card" style={{ padding: '20px', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ fontSize: '1.2rem' }}>📅</span>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Kalender & Hari Libur (WIB)</h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Jadwal jam kerja harian dan tanggal merah</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-status">Status Operasional Manual</label>
                  <select
                    id="ops-param-status"
                    value={storeStatus}
                    onChange={(e) => setStoreStatus(e.target.value)}
                  >
                    <option value="ONLINE">ONLINE (Layanan aktif, proses 5 - 20 menit)</option>
                    <option value="RESTING">ISTIRAHAT (Toko tutup sementara / antrean malam)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '14px', backgroundColor: 'var(--surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={holidayMode}
                      onChange={(e) => setHolidayMode(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink)' }}>
                      Aktifkan Mode Hari Libur Otomatis
                    </span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                    Jika aktif, sistem otomatis masuk mode libur pada tanggal yang terdaftar di bawah.
                  </span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-holidays">Daftar Tanggal Libur Toko (YYYY-MM-DD)</label>
                  <input
                    id="ops-param-holidays"
                    type="text"
                    value={holidayDates}
                    onChange={(e) => setHolidayDates(e.target.value)}
                    placeholder="2026-12-25, 2027-01-01"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Pisahkan dengan koma. Contoh: 2026-08-17, 2026-12-25, 2027-01-01.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label htmlFor="ops-param-op-start">Buka (WIB)</label>
                    <input
                      id="ops-param-op-start"
                      type="time"
                      value={opHoursStart}
                      onChange={(e) => setOpHoursStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="ops-param-op-end">Tutup (WIB)</label>
                    <input
                      id="ops-param-op-end"
                      type="time"
                      value={opHoursEnd}
                      onChange={(e) => setOpHoursEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="ops-param-holiday-notice">Pesan Saat Hari Libur</label>
                  <input
                    id="ops-param-holiday-notice"
                    type="text"
                    value={holidayNotice}
                    onChange={(e) => setHolidayNotice(e.target.value)}
                    placeholder="Toko libur operasional. Pesanan diproses esok hari."
                  />
                </div>
              </div>

              {/* KARTU 3: TRANSAKSI & SIKLUS PESANAN */}
              <div className="card" style={{ padding: '20px', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚡</span>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Transaksi & Siklus Pesanan</h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Batas waktu bayar, toleransi verifikasi & SLA</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-payment-exp">Batas Waktu Bayar QRIS (Menit)</label>
                  <input
                    id="ops-param-payment-exp"
                    type="number"
                    min="3"
                    max="60"
                    value={paymentExpiryMins}
                    onChange={(e) => setPaymentExpiryMins(e.target.value)}
                    placeholder="10"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Durasi countdown QRIS pembeli sebelum masuk antrean verifikasi (default: 10 menit).
                  </span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-verify-window">Batas Toleransi Verifikasi Admin (Jam)</label>
                  <input
                    id="ops-param-verify-window"
                    type="number"
                    min="1"
                    max="72"
                    value={verifyWindowHours}
                    onChange={(e) => setVerifyWindowHours(e.target.value)}
                    placeholder="24"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Masa toleransi admin dapat menandai lunas sebelum pesanan hangus permanen (default: 24 jam).
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label htmlFor="ops-param-sla-target">Target SLA (Mnt)</label>
                    <input
                      id="ops-param-sla-target"
                      type="number"
                      min="5"
                      max="60"
                      value={slaTargetMins}
                      onChange={(e) => setSlaTargetMins(e.target.value)}
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <label htmlFor="ops-param-sla-breach">Breach Warning (Mnt)</label>
                    <input
                      id="ops-param-sla-breach"
                      type="number"
                      min="10"
                      max="120"
                      value={slaBreachMins}
                      onChange={(e) => setSlaBreachMins(e.target.value)}
                      placeholder="20"
                    />
                  </div>
                </div>
              </div>

              {/* KARTU 4: KONTAK & INTEGRASI NOTIFIKASI */}
              <div className="card" style={{ padding: '20px', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔌</span>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Kontak & Integrasi Bot</h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>WhatsApp CS dan Bot Telegram order realtime</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-phone">Nomor WhatsApp CS Toko</label>
                  <input
                    id="ops-param-phone"
                    type="text"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="085861708659"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Tujuan konfirmasi pembayaran dan bantuan darurat pembeli.
                  </span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-baseline">Baseline Lisensi Terkirim</label>
                  <input
                    id="ops-param-baseline"
                    type="text"
                    inputMode="numeric"
                    value={formatNumberDisplay(baselineLicenses)}
                    onChange={(e) => setBaselineLicenses(e.target.value.replace(/\D/g, ''))}
                    placeholder="50"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Angka dasar untuk counter lisensi terkirim di beranda.
                  </span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="ops-param-tg-token">Telegram Bot Token (Opsional)</label>
                  <input
                    id="ops-param-tg-token"
                    type="password"
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl..."
                  />
                </div>

                <div>
                  <label htmlFor="ops-param-tg-chat">Telegram Admin Chat ID (Opsional)</label>
                  <input
                    id="ops-param-tg-chat"
                    type="text"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    placeholder="-100123456789"
                  />
                </div>
              </div>

              {/* KARTU 5: PROMO, KUPON & BANNER DISKON (LANDSCAPE FULL WIDTH) */}
              <div className="card" style={{ padding: '24px', border: '1px solid var(--accent-gold)', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem', color: 'var(--gold-light)' }}>🏷️</span>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold-light)', margin: 0 }}>Promo, Kupon & Diskon Toko</h3>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Konfigurasi banner promo, kode kupon utama, dan manajemen daftar kupon aktif</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
                  {/* Kolom Kiri: Pengaturan Kupon Utama & Banner */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={promoEnabled}
                          onChange={(e) => setPromoEnabled(e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>
                          Aktifkan Fitur Kupon Promo
                        </span>
                      </label>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                        Jika dinonaktifkan, kupon promo tidak dapat digunakan di form checkout toko.
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                      <div>
                        <label htmlFor="ops-param-promo-code">Kode Kupon Utama</label>
                        <input
                          id="ops-param-promo-code"
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                          placeholder="BVAULTHEMAT"
                          style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--gold-light)' }}
                        />
                      </div>
                      <div>
                        <label htmlFor="ops-param-promo-pct">Diskon (%)</label>
                        <input
                          id="ops-param-promo-pct"
                          type="number"
                          min="1"
                          max="100"
                          value={promoDiscountPercent}
                          onChange={(e) => setPromoDiscountPercent(e.target.value)}
                          placeholder="10"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="ops-param-promo-min">Minimal Belanja Kupon (Rp)</label>
                      <input
                        id="ops-param-promo-min"
                        type="text"
                        inputMode="numeric"
                        value={formatNumberDisplay(promoMinOrderAmount)}
                        onChange={(e) => setPromoMinOrderAmount(e.target.value.replace(/\D/g, ''))}
                        placeholder="0 (Tanpa minimal)"
                      />
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        Kupon hanya berlaku jika subtotal pesanan mencapai nilai ini.
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={promoBannerActive}
                          onChange={(e) => setPromoBannerActive(e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>
                          Tampilkan Banner Promo di Toko
                        </span>
                      </label>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                        Teks berjalan/banner promo akan muncul di atas katalog produk utama.
                      </span>
                    </div>

                    <div>
                      <label htmlFor="ops-param-promo-banner-text">Teks Pengumuman Banner Promo</label>
                      <textarea
                        id="ops-param-promo-banner-text"
                        rows={2}
                        value={promoBannerText}
                        onChange={(e) => setPromoBannerText(e.target.value)}
                        placeholder="🔥 Promo Spesial: Gunakan kode BVAULTHEMAT untuk diskon 10%!"
                      />
                    </div>
                  </div>

                  {/* Kolom Kanan: Tabel Kupon Aktif & CRUD */}
                  <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '16px 18px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.94rem', color: 'var(--ink)' }}>
                          Daftar Kode Kupon Aktif &amp; Diskon ({coupons.length})
                        </h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Kelola kode promo khusus, persentase diskon, dan batas minimal belanja.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleOpenCreateCoupon}
                        style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                      >
                        + Tambah Kupon
                      </button>
                    </div>

                    {couponMessage && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-xs)',
                        marginBottom: '12px',
                        fontSize: '0.8rem',
                        backgroundColor: couponMessage.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: couponMessage.isError ? '#ef4444' : '#10b981',
                        border: `1px solid ${couponMessage.isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                      }}>
                        {couponMessage.text}
                      </div>
                    )}

                    {coupons.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 16px', backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-xs)', border: '1px dashed var(--hairline)', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        Belum ada kode kupon tambahan. Klik tombol <strong>+ Tambah Kupon</strong> untuk membuat promo baru.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--surface-card)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--hairline)' }}>
                              <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>KODE</th>
                              <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>POTONGAN</th>
                              <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>MIN. BELANJA</th>
                              <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
                              <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>AKSI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {coupons.map((c) => (
                              <tr key={c.id} style={{ borderBottom: '1px solid var(--hairline)', opacity: c.is_active ? 1 : 0.6 }}>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-gold)' }}>
                                      {c.code}
                                    </span>
                                  </div>
                                  {c.notes && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                      {c.notes}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ink)' }}>
                                  {c.discount_type === 'PERCENT' ? (
                                    <span>
                                      {c.discount_value}%
                                      {c.max_discount_amount && c.max_discount_amount > 0 ? (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                                          Maks. Rp {c.max_discount_amount.toLocaleString('id-ID')}
                                        </span>
                                      ) : null}
                                    </span>
                                  ) : (
                                    <span>Rp {c.discount_value.toLocaleString('id-ID')}</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>
                                  {c.min_order_amount > 0 ? `Rp ${c.min_order_amount.toLocaleString('id-ID')}` : 'Tanpa minimal'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCoupon(c.id)}
                                    disabled={couponLoading}
                                    style={{
                                      border: 'none',
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      backgroundColor: c.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.2)',
                                      color: c.is_active ? '#10b981' : 'var(--text-muted)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title="Klik untuk beralih aktif/nonaktif"
                                  >
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c.is_active ? '#10b981' : '#94a3b8' }}></span>
                                    {c.is_active ? 'Aktif' : 'Nonaktif'}
                                  </button>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditCoupon(c)}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      borderRadius: 'var(--radius-xs)',
                                      border: '1px solid var(--hairline)',
                                      backgroundColor: 'var(--surface-card)',
                                      color: 'var(--ink)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCoupon(c.id, c.code)}
                                    disabled={couponLoading}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.74rem',
                                      borderRadius: 'var(--radius-xs)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            </div>

            {/* Bottom Submit Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', backgroundColor: 'var(--surface-card)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSettings}
                style={{ padding: '12px 28px', fontSize: '0.92rem', fontWeight: 700, minHeight: '44px' }}
              >
                {savingSettings ? 'Menyimpan Parameter...' : 'Simpan Semua Parameter Sistem'}
              </button>
            </div>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '100%' }}>
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
                        fontWeight: Number(variantForm.duration_days) === 0 ? 700 : 500,
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => {
                        setVariantForm({
                          ...variantForm,
                          duration_days: Number(variantForm.duration_days) === 0 ? 30 : 0
                        });
                      }}
                    >
                      {Number(variantForm.duration_days) === 0 ? '✓ Lifetime' : '+ Lifetime'}
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 30 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      30 Hari
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 365 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      1 Tahun (365)
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, duration_days: 0 })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                    >
                      ✦ Lifetime
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
                        fontWeight: Number(variantForm.warranty_duration_days) === 0 ? 700 : 500,
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => {
                        setVariantForm({
                          ...variantForm,
                          warranty_duration_days: Number(variantForm.warranty_duration_days) === 0 ? 30 : 0
                        });
                      }}
                    >
                      {Number(variantForm.warranty_duration_days) === 0 ? '✓ Lifetime' : '+ Lifetime'}
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 30 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      30 Hari
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 365 })}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      1 Tahun (365)
                    </button>
                    <span style={{ color: 'var(--hairline)', fontSize: '0.72rem' }}>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setVariantForm({ ...variantForm, warranty_duration_days: 0 })}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.74rem', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                    >
                      ✦ Lifetime
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

      {/* Modal CRUD Kupon Promo */}
      {couponModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => !couponLoading && setCouponModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface-card)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius-sm)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ink)' }}>
                {editingCouponId ? 'Edit Kode Kupon Promo' : 'Tambah Kupon Promo Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setCouponModalOpen(false)}
                disabled={couponLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoupon}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="coupon-code-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                    Kode Kupon Promo <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="coupon-code-input"
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="Contoh: DISKON50, PROMOJUMAT"
                    style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                    Otomatis diubah menjadi huruf kapital tanpa spasi.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="coupon-discount-type" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                      Tipe Potongan
                    </label>
                    <select
                      id="coupon-discount-type"
                      value={couponForm.discount_type}
                      onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value as 'PERCENT' | 'FIXED' })}
                    >
                      <option value="PERCENT">Persentase (%)</option>
                      <option value="FIXED">Nominal Tetap (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="coupon-discount-val" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                      Besar Potongan <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {couponForm.discount_type === 'PERCENT' ? (
                      <input
                        id="coupon-discount-val"
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={couponForm.discount_value}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                        placeholder="10"
                      />
                    ) : (
                      <input
                        id="coupon-discount-val"
                        type="text"
                        inputMode="numeric"
                        required
                        value={formatNumberDisplay(couponForm.discount_value)}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value.replace(/\D/g, '') })}
                        placeholder="15.000"
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: couponForm.discount_type === 'PERCENT' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="coupon-min-order" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                      Minimal Belanja (Rp)
                    </label>
                    <input
                      id="coupon-min-order"
                      type="text"
                      inputMode="numeric"
                      value={formatNumberDisplay(couponForm.min_order_amount)}
                      onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value.replace(/\D/g, '') })}
                      placeholder="0 (Tanpa minimal)"
                    />
                  </div>

                  {couponForm.discount_type === 'PERCENT' && (
                    <div>
                      <label htmlFor="coupon-max-discount" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                        Maks. Potongan (Rp)
                      </label>
                      <input
                        id="coupon-max-discount"
                        type="text"
                        inputMode="numeric"
                        value={formatNumberDisplay(couponForm.max_discount_amount)}
                        onChange={(e) => setCouponForm({ ...couponForm, max_discount_amount: e.target.value.replace(/\D/g, '') })}
                        placeholder="0 (Tanpa batas)"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="coupon-notes" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                    Catatan Kupon (Opsional)
                  </label>
                  <input
                    id="coupon-notes"
                    type="text"
                    value={couponForm.notes}
                    onChange={(e) => setCouponForm({ ...couponForm, notes: e.target.value })}
                    placeholder="Contoh: Kupon promo komunitas Discord"
                  />
                </div>

                <div style={{ backgroundColor: 'var(--surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--hairline)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={couponForm.is_active}
                      onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink)' }}>
                      Aktifkan Kupon Sekarang
                    </span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Jika dinonaktifkan, pembeli tidak dapat menggunakan kode ini saat checkout.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCouponModalOpen(false)}
                  disabled={couponLoading}
                  style={{ fontSize: '0.82rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={couponLoading}
                  style={{ fontSize: '0.82rem' }}
                >
                  {couponLoading ? 'Menyimpan...' : editingCouponId ? 'Perbarui Kupon' : 'Buat Kupon'}
                </button>
              </div>
            </form>
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
