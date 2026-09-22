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
    };
  } catch {
    return { ...DEFAULT_PARAMETERS };
  }
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
