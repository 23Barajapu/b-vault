import { NextResponse } from 'next/server';
import crypto from 'crypto';
import supabase from '@/lib/supabase';
import { getSystemParameters, findMatchingCoupon } from '@/lib/settings';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const WA_REGEX = /^(?:\+62|62|0)8[1-9][0-9]{7,11}$/;
const DISPOSABLE_DOMAINS = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'throwawaymail.com', 'yopmail.com'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { variant_id, customer_name, customer_email, customer_whatsapp, target_account_input, payment_method, coupon_code } = body;

    // 1. Validasi varian
    if (!variant_id) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_VARIANT', message: 'Varian produk wajib dipilih.' } },
        { status: 422 }
      );
    }

    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .select('*, products:product_id(title, platform_name)')
      .eq('id', variant_id)
      .eq('is_active', 1)
      .single();

    if (varErr || !variant) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_VARIANT_NOT_FOUND', message: 'Varian produk tidak ditemukan atau tidak aktif.' } },
        { status: 404 }
      );
    }

    // 2. Validasi Email
    if (!customer_email || !EMAIL_REGEX.test(customer_email)) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_EMAIL', message: 'Format email tidak valid.' } },
        { status: 422 }
      );
    }

    const cleanEmail = customer_email.toLowerCase().trim();
    const emailDomain = cleanEmail.split('@')[1];
    if (DISPOSABLE_DOMAINS.includes(emailDomain)) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_DISPOSABLE_EMAIL', message: 'Email sementara tidak diperbolehkan. Gunakan email pribadi Anda.' } },
        { status: 422 }
      );
    }

    // 3. Validasi WhatsApp
    if (!customer_whatsapp || !WA_REGEX.test(customer_whatsapp.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_PHONE', message: 'Nomor WhatsApp tidak valid. Format: 08123456789 atau +628123456789.' } },
        { status: 422 }
      );
    }
    const cleanPhone = customer_whatsapp.replace(/\s+/g, '');

    // 4. Target Account Input (Opsional - default ke email pembeli)
    const effectiveTargetAccount = (target_account_input && typeof target_account_input === 'string' && target_account_input.trim())
      ? target_account_input.trim()
      : cleanEmail;

    // 5. Validasi Payment Method (Hanya QRIS)
    const effectivePaymentMethod = 'QRIS';

    // 6. Validasi Nama Pembeli
    const cleanName = (customer_name && typeof customer_name === 'string') ? customer_name.trim() : cleanEmail.split('@')[0];
    if (cleanName.length < 3 || cleanName.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_NAME', message: 'Nama pembeli harus antara 3 sampai 100 karakter.' } },
        { status: 422 }
      );
    }

    // Silent user provisioning
    let { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    let userId = existingUser?.id;
    if (!userId) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ name: cleanName, email: cleanEmail, phone_number: cleanPhone, role: 'customer' })
        .select('id')
        .single();
      userId = newUser?.id;
    }

    // Generate Order Number & Secure Token
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `INV-${dateStr}-${randomSuffix}`;
    const secureToken = crypto.randomBytes(32).toString('hex');

    // Dynamic payment expiration from system parameters
    const sysParams = await getSystemParameters();
    const expiryMins = sysParams.payment_expiry_minutes || 10;
    const expiredAt = new Date(Date.now() + expiryMins * 60 * 1000).toISOString();

    // 7. Kalkulasi Diskon Promo Dinamis dari Daftar Kupon Aktif
    let finalAmount = Number(variant.retail_price);
    const cleanCoupon = typeof coupon_code === 'string' ? coupon_code.trim().toUpperCase() : '';
    if (cleanCoupon && sysParams.promo_enabled) {
      const match = findMatchingCoupon(sysParams.promo_coupons || [], cleanCoupon, finalAmount);
      if (match.valid && match.discountAmount > 0) {
        finalAmount = Math.max(1000, finalAmount - match.discountAmount);
      }
    }

    // Generate payment payload (QRIS Baraja Putra)
    const paymentChannelData: Record<string, any> = {
      method: effectivePaymentMethod,
      amount: finalAmount,
      currency: 'IDR',
      qr_content: `00020101021226670016ID.CO.B-VAULT.WWW01189360091100000000005204581253033605405${finalAmount}5802ID5910B-VAULT6007JAKARTA61051234062070703A016304${orderNumber.slice(-4)}`,
      qr_image_url: '/qris-all-pay.jpeg',
      merchant_name: 'BARAJA PUTRA, DIGITAL & KREATIF',
      nmid: 'ID1026505289292',
    };

    // Insert Order in Supabase
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        secure_token: secureToken,
        user_id: userId,
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
        target_account_input: effectiveTargetAccount,
        total_amount: finalAmount,
        payment_status: 'PENDING_PAYMENT',
        payment_method: effectivePaymentMethod,
        payment_reference: `REF-${orderNumber}`,
        payment_channel_data: JSON.stringify(paymentChannelData),
        expired_at: expiredAt,
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      throw new Error(orderErr?.message || 'Gagal menyimpan data pesanan.');
    }

    // Insert Order Item
    await supabase.from('order_items').insert({
      order_id: order.id,
      variant_id: variant.id,
      unit_price: finalAmount,
      cost_price: variant.cost_price || 0,
      retail_price: variant.retail_price,
    });

    return NextResponse.json({
      success: true,
      data: {
        order_number: orderNumber,
        secure_token: secureToken,
        total_amount: finalAmount,
        payment_method,
        payment_channel_data: paymentChannelData,
        expired_at: expiredAt,
        redirect_url: `/orders/${orderNumber}?token=${secureToken}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_CHECKOUT_FAILED',
          message: error.message || 'Gagal memproses checkout.',
        },
      },
      { status: 500 }
    );
  }
}
