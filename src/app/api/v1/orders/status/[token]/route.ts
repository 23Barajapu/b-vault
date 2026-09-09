import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_TOKEN_MISSING', message: 'Token otentikasi pesanan tidak ditemukan.' } },
        { status: 400 }
      );
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('secure_token', token)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan atau tautan tidak valid.' } },
        { status: 404 }
      );
    }

    // Auto expire check if still pending and past expired_at
    if (order.payment_status === 'PENDING_PAYMENT' && new Date(order.expired_at).getTime() < Date.now()) {
      await supabase.from('orders').update({ payment_status: 'EXPIRED' }).eq('id', order.id);
      order.payment_status = 'EXPIRED';
    }

    // Fetch order items with variant and product
    const { data: items } = await supabase
      .from('order_items')
      .select(`
        *,
        product_variants (
          name,
          duration_days,
          activation_guide,
          warranty_duration_days,
          estimated_delivery_text,
          products (
            title,
            platform_name,
            thumbnail_url
          )
        )
      `)
      .eq('order_id', order.id);

    // Fetch store settings
    const { data: settings } = await supabase.from('store_settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s) => { settingsMap[s.key] = s.value; });

    // Calculate elapsed minutes since paid_at
    let elapsedMinutesSincePaid = 0;
    if (order.paid_at) {
      const paidTime = new Date(order.paid_at).getTime();
      elapsedMinutesSincePaid = Math.floor((Date.now() - paidTime) / (60 * 1000));
    }

    // Parse channel data safely
    let channelData = null;
    try {
      channelData = order.payment_channel_data ? JSON.parse(order.payment_channel_data) : null;
    } catch {
      channelData = null;
    }

    // Hide sensitive activation payload if not fulfilled yet
    const sanitizedItems = (items || []).map((item: any) => {
      const isFulfilled = order.payment_status === 'FULFILLED';
      const variant = item.product_variants;
      const product = variant?.products;

      return {
        id: item.id,
        product_title: product?.title || 'Lisensi Pro',
        platform_name: product?.platform_name || '',
        variant_name: variant?.name || '',
        duration_days: variant?.duration_days || 30,
        unit_price: item.unit_price,
        estimated_delivery_text: variant?.estimated_delivery_text || '5 - 20 Menit',
        activation_payload: isFulfilled ? item.activation_payload : null,
        admin_delivery_notes: isFulfilled ? item.admin_delivery_notes : null,
        activation_guide: isFulfilled ? variant?.activation_guide : null,
        warranty_expired_at: isFulfilled ? item.warranty_expired_at : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          target_account_input: order.target_account_input,
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          payment_channel_data: channelData,
          supplier_issue: Boolean(order.supplier_issue),
          paid_at: order.paid_at,
          expired_at: order.expired_at,
          fulfilled_at: order.fulfilled_at,
          created_at: order.created_at,
          elapsed_minutes_since_paid: elapsedMinutesSincePaid,
        },
        items: sanitizedItems,
        support: {
          admin_whatsapp: settingsMap['admin_whatsapp'] || '085183410190',
          is_sla_breached: elapsedMinutesSincePaid >= 20,
          store_status: settingsMap['store_status'] || 'ONLINE',
          store_notice: settingsMap['operating_hours_notice'] || '',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_ORDER_STATUS',
          message: error.message || 'Gagal memeriksa status pesanan.',
        },
      },
      { status: 500 }
    );
  }
}
