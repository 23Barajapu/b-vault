import supabase from '@/lib/supabase';

export interface SystemParameters {
  // 1. User & Sesi (Security)
  session_idle_timeout_minutes: number;
  session_max_lifetime_hours: number;
  max_login_attempts: number;

  // 2. Kalender & Hari Libur (Operasional)
  store_status: 'ONLINE' | 'RESTING';
  holiday_mode: boolean;
  holiday_dates: string[];
  holiday_notice: string;
  operating_hours_start: string;
  operating_hours_end: string;
  operating_hours_notice: string;

  // 3. Transaksi & Siklus Pesanan (E-Commerce)
  payment_expiry_minutes: number;
  verification_window_hours: number;
  sla_target_minutes: number;
  sla_breach_minutes: number;

  // 4. Toko & Integrasi
  admin_whatsapp: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  baseline_delivered_licenses: number;

  // 5. Promo, Kupon & Diskon
  promo_enabled: boolean;
  promo_code: string;
  promo_discount_percent: number;
  promo_min_order_amount: number;
  promo_banner_active: boolean;
  promo_banner_text: string;
  promo_coupons: PromoCoupon[];
}

export interface PromoCoupon {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export const DEFAULT_PARAMETERS: SystemParameters = {
  // Sesi
  session_idle_timeout_minutes: 5,
  session_max_lifetime_hours: 8,
  max_login_attempts: 5,

  // Operasional & Libur
  store_status: 'ONLINE',
  holiday_mode: false,
  holiday_dates: [],
  holiday_notice: 'Toko sedang libur operasional. Seluruh pesanan akan diproses kembali saat toko buka.',
  operating_hours_start: '08:00',
  operating_hours_end: '23:00',
  operating_hours_notice: 'Pesanan di luar jam kerja (23:00 - 07:30 WIB) diproses mulai pukul 08:00 WIB',

  // Transaksi
  payment_expiry_minutes: 10,
  verification_window_hours: 24,
  sla_target_minutes: 15,
  sla_breach_minutes: 20,

  // Integrasi
  admin_whatsapp: '085861708659',
  telegram_bot_token: '',
  telegram_chat_id: '',
  baseline_delivered_licenses: 50,

  // Promo & Diskon
  promo_enabled: true,
  promo_code: 'BVAULTHEMAT',
  promo_discount_percent: 10,
  promo_min_order_amount: 0,
  promo_banner_active: true,
  promo_banner_text: '🔥 Promo Spesial: Gunakan kode kupon BVAULTHEMAT untuk diskon 10% semua lisensi pro resmi!',
  promo_coupons: [
    {
      id: 'cp_bv_default_1',
      code: 'BVAULTHEMAT',
      discount_type: 'PERCENT',
      discount_value: 10,
      min_order_amount: 0,
      is_active: true,
      notes: 'Kupon promo resmi B-Vault 10%',
      created_at: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'cp_bv_default_2',
      code: 'BARAJAPU',
      discount_type: 'PERCENT',
      discount_value: 10,
      min_order_amount: 50000,
      is_active: true,
      notes: 'Kupon loyalty Baraja Putra',
      created_at: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'cp_bv_default_3',
      code: 'VAULTPRO20',
      discount_type: 'PERCENT',
      discount_value: 20,
      min_order_amount: 100000,
      is_active: true,
      notes: 'Promo khusus pembelian di atas 100rb',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ],
};

/**
 * Mengambil seluruh parameter sistem dari tabel store_settings
 * dengan fallback nilai default yang aman.
 */
export async function getSystemParameters(): Promise<SystemParameters> {
  try {
    const { data: rows, error } = await supabase.from('store_settings').select('key, value');
    if (error || !rows) {
      return { ...DEFAULT_PARAMETERS };
    }

    const dict: Record<string, string> = {};
    for (const r of rows) {
      dict[r.key] = r.value;
    }

    // Parsing array tanggal libur
    let holidayDates: string[] = [];
    if (dict.holiday_dates) {
      holidayDates = dict.holiday_dates
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return {
      // Sesi
      session_idle_timeout_minutes: dict.session_idle_timeout_minutes
        ? Math.max(1, Number(dict.session_idle_timeout_minutes) || DEFAULT_PARAMETERS.session_idle_timeout_minutes)
        : DEFAULT_PARAMETERS.session_idle_timeout_minutes,
      session_max_lifetime_hours: dict.session_max_lifetime_hours
        ? Math.max(1, Number(dict.session_max_lifetime_hours) || DEFAULT_PARAMETERS.session_max_lifetime_hours)
        : DEFAULT_PARAMETERS.session_max_lifetime_hours,
      max_login_attempts: dict.max_login_attempts
        ? Math.max(1, Number(dict.max_login_attempts) || DEFAULT_PARAMETERS.max_login_attempts)
        : DEFAULT_PARAMETERS.max_login_attempts,

      // Operasional
      store_status: dict.store_status === 'RESTING' ? 'RESTING' : 'ONLINE',
      holiday_mode: dict.holiday_mode === 'true' || dict.holiday_mode === '1',
      holiday_dates: holidayDates,
      holiday_notice: dict.holiday_notice || DEFAULT_PARAMETERS.holiday_notice,
      operating_hours_start: dict.operating_hours_start || DEFAULT_PARAMETERS.operating_hours_start,
      operating_hours_end: dict.operating_hours_end || DEFAULT_PARAMETERS.operating_hours_end,
      operating_hours_notice: dict.operating_hours_notice || DEFAULT_PARAMETERS.operating_hours_notice,

      // Transaksi
      payment_expiry_minutes: dict.payment_expiry_minutes
        ? Math.max(1, Number(dict.payment_expiry_minutes) || DEFAULT_PARAMETERS.payment_expiry_minutes)
        : DEFAULT_PARAMETERS.payment_expiry_minutes,
      verification_window_hours: dict.verification_window_hours
        ? Math.max(1, Number(dict.verification_window_hours) || DEFAULT_PARAMETERS.verification_window_hours)
        : DEFAULT_PARAMETERS.verification_window_hours,
      sla_target_minutes: dict.sla_target_minutes
        ? Math.max(1, Number(dict.sla_target_minutes) || DEFAULT_PARAMETERS.sla_target_minutes)
        : DEFAULT_PARAMETERS.sla_target_minutes,
      sla_breach_minutes: dict.sla_breach_minutes
        ? Math.max(1, Number(dict.sla_breach_minutes) || DEFAULT_PARAMETERS.sla_breach_minutes)
        : DEFAULT_PARAMETERS.sla_breach_minutes,

      // Integrasi
      admin_whatsapp: dict.admin_whatsapp || DEFAULT_PARAMETERS.admin_whatsapp,
      telegram_bot_token: dict.telegram_bot_token ?? DEFAULT_PARAMETERS.telegram_bot_token,
      telegram_chat_id: dict.telegram_chat_id ?? DEFAULT_PARAMETERS.telegram_chat_id,
      baseline_delivered_licenses: dict.baseline_delivered_licenses
        ? Number(dict.baseline_delivered_licenses) || DEFAULT_PARAMETERS.baseline_delivered_licenses
        : DEFAULT_PARAMETERS.baseline_delivered_licenses,

      // Promo & Diskon
      promo_enabled: dict.promo_enabled !== undefined
        ? dict.promo_enabled === 'true' || dict.promo_enabled === '1'
        : DEFAULT_PARAMETERS.promo_enabled,
      promo_code: (dict.promo_code || DEFAULT_PARAMETERS.promo_code).trim().toUpperCase(),
      promo_discount_percent: dict.promo_discount_percent
        ? Math.max(1, Math.min(100, Number(dict.promo_discount_percent) || DEFAULT_PARAMETERS.promo_discount_percent))
        : DEFAULT_PARAMETERS.promo_discount_percent,
      promo_min_order_amount: dict.promo_min_order_amount
        ? Math.max(0, Number(dict.promo_min_order_amount) || 0)
        : DEFAULT_PARAMETERS.promo_min_order_amount,
      promo_banner_active: dict.promo_banner_active !== undefined
        ? dict.promo_banner_active === 'true' || dict.promo_banner_active === '1'
        : DEFAULT_PARAMETERS.promo_banner_active,
      promo_banner_text: dict.promo_banner_text || DEFAULT_PARAMETERS.promo_banner_text,
      promo_coupons: (() => {
        if (!dict.promo_coupons_list) return DEFAULT_PARAMETERS.promo_coupons;
        try {
          const parsed = JSON.parse(dict.promo_coupons_list);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((c: any, idx: number) => ({
              id: c.id || `cp_${Date.now()}_${idx}`,
              code: (c.code || '').trim().toUpperCase(),
              discount_type: c.discount_type === 'FIXED' ? 'FIXED' : 'PERCENT',
              discount_value: Math.max(1, Number(c.discount_value) || 10),
              min_order_amount: Math.max(0, Number(c.min_order_amount) || 0),
              max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
              is_active: c.is_active !== undefined ? Boolean(c.is_active) : true,
              notes: c.notes || '',
              created_at: c.created_at || new Date().toISOString(),
            }));
          }
        } catch {}
        return DEFAULT_PARAMETERS.promo_coupons;
      })(),
    };
  } catch {
    return { ...DEFAULT_PARAMETERS };
  }
}

/**
 * Mencari kupon yang cocok dari daftar kupon aktif dan menghitung nilai potongan.
 */
export function findMatchingCoupon(
  coupons: PromoCoupon[],
  code: string,
  orderAmount: number
): {
  valid: boolean;
  coupon?: PromoCoupon;
  discountAmount: number;
  message: string;
} {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discountAmount: 0, message: 'Kode kupon wajib diisi.' };
  }

  const coupon = coupons.find((c) => c.code.toUpperCase() === cleanCode);
  if (!coupon) {
    return { valid: false, discountAmount: 0, message: 'Kode kupon tidak valid atau tidak terdaftar.' };
  }

  if (!coupon.is_active) {
    return { valid: false, discountAmount: 0, message: 'Kupon ini sedang non-aktif.' };
  }

  if (coupon.min_order_amount > 0 && orderAmount < coupon.min_order_amount) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimal belanja untuk kupon ini adalah Rp ${coupon.min_order_amount.toLocaleString('id-ID')}.`,
    };
  }

  let discount = 0;
  if (coupon.discount_type === 'PERCENT') {
    discount = Math.round(orderAmount * (coupon.discount_value / 100));
    if (coupon.max_discount_amount && coupon.max_discount_amount > 0) {
      discount = Math.min(discount, coupon.max_discount_amount);
    }
  } else {
    discount = Math.round(coupon.discount_value);
  }

  // Jaga agar total tidak minus (sisakan minimal Rp 1.000 untuk QRIS)
  discount = Math.min(discount, Math.max(0, orderAmount - 1000));

  return {
    valid: true,
    coupon,
    discountAmount: discount,
    message: `Kupon ${coupon.code} aktif! Diskon ${
      coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}%` : ''
    } (Rp ${discount.toLocaleString('id-ID')}) berhasil diterapkan.`,
  };
}

/**
 * Menghitung status operasional toko realtime (WIB, UTC+7)
 * Memeriksa saklar manual, mode libur, dan jam operasional harian.
 */
export function isStoreOperational(params: SystemParameters): {
  isOpen: boolean;
  status: 'ONLINE' | 'RESTING' | 'HOLIDAY';
  notice: string;
} {
  // 1. Cek saklar manual istirahat
  if (params.store_status === 'RESTING') {
    return {
      isOpen: false,
      status: 'RESTING',
      notice: params.operating_hours_notice,
    };
  }

  // Zona waktu WIB (UTC+7)
  const nowUtc = new Date();
  const wibTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibTime.getUTCFullYear();
  const mm = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibTime.getUTCDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // 2. Cek apakah hari ini terdaftar sebagai hari libur
  if (params.holiday_mode && params.holiday_dates.includes(todayStr)) {
    return {
      isOpen: false,
      status: 'HOLIDAY',
      notice: params.holiday_notice,
    };
  }

  // 3. Cek jam operasional harian (format HH:MM)
  const currentHours = wibTime.getUTCHours();
  const currentMinutes = wibTime.getUTCMinutes();
  const currentMinutesTotal = currentHours * 60 + currentMinutes;

  const [startH, startM] = (params.operating_hours_start || '08:00').split(':').map(Number);
  const [endH, endM] = (params.operating_hours_end || '23:00').split(':').map(Number);
  const startMinutesTotal = (startH || 0) * 60 + (startM || 0);
  const endMinutesTotal = (endH || 23) * 60 + (endM || 0);

  if (currentMinutesTotal < startMinutesTotal || currentMinutesTotal > endMinutesTotal) {
    return {
      isOpen: false,
      status: 'RESTING',
      notice: params.operating_hours_notice,
    };
  }

  return {
    isOpen: true,
    status: 'ONLINE',
    notice: '',
  };
}
