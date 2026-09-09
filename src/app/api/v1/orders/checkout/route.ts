import { NextResponse } from 'next/server';
import crypto from 'crypto';
import supabase from '@/lib/supabase';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const WA_REGEX = /^(?:\+62|62|0)8[1-9][0-9]{7,11}$/;
const DISPOSABLE_DOMAINS = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'throwawaymail.com', 'yopmail.com'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { variant_id, customer_name, customer_email, customer_whatsapp, target_account_input, payment_method } = body;

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

    // 4. Validasi Target Account Input
    if (variant.input_requirement_label && (!target_account_input || target_account_input.trim().length < 5)) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_TARGET_INPUT_REQUIRED', message: `Kolom ${variant.input_requirement_label} wajib diisi minimal 5 karakter.` } },
        { status: 422 }
      );
    }

    // 5. Validasi Payment Method
    const validMethods = ['QRIS', 'BCA_VA', 'MANDIRI_VA', 'BNI_VA', 'BRI_VA'];
    if (!payment_method || !validMethods.includes(payment_method)) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_PAYMENT_METHOD', message: 'Metode pembayaran tidak didukung.' } },
        { status: 422 }
      );
    }

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

    // 15 minutes expiration
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Generate payment payload
    const paymentChannelData: Record<string, any> = {
      method: payment_method,
      amount: variant.retail_price,
      currency: 'IDR',
    };

    if (payment_method === 'QRIS') {
      paymentChannelData.qr_content = `00020101021226670016ID.CO.B-VAULT.WWW01189360091100000000005204581253033605405${variant.retail_price}5802ID5910B-VAULT6007JAKARTA61051234062070703A016304${orderNumber.slice(-4)}`;
      paymentChannelData.qr_image_url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentChannelData.qr_content)}`;
    } else {
      const bankCode = payment_method.replace('_VA', '');
      const prefixMap: Record<string, string> = {
        BCA: '88000',
        MANDIRI: '89000',
        BNI: '98800',
        BRI: '88800',
      };
      const prefix = prefixMap[bankCode] || '88000';
      const cleanPhoneDigits = cleanPhone.replace(/\D/g, '').slice(-8);
      paymentChannelData.va_number = `${prefix}${cleanPhoneDigits}`;
      paymentChannelData.bank_name = bankCode;
    }

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
        target_account_input: target_account_input ? target_account_input.trim() : null,
        total_amount: variant.retail_price,
        payment_status: 'PENDING_PAYMENT',
        payment_method,
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
      unit_price: variant.retail_price,
      cost_price: variant.cost_price || 0,
      retail_price: variant.retail_price,
    });

    return NextResponse.json({
      success: true,
      data: {
        order_number: orderNumber,
        secure_token: secureToken,
        total_amount: variant.retail_price,
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
