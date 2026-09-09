import { NextResponse } from 'next/server';
import db from '@/lib/db';

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

    const order = db.prepare(`
      SELECT o.*
      FROM orders o
      WHERE o.secure_token = ?
    `).get(token) as any;

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan atau tautan tidak valid.' } },
        { status: 404 }
      );
    }

    // Auto expire check if still pending and past expired_at
    if (order.payment_status === 'PENDING_PAYMENT' && new Date(order.expired_at).getTime() < Date.now()) {
      db.prepare("UPDATE orders SET payment_status = 'EXPIRED' WHERE id = ?").run(order.id);
      order.payment_status = 'EXPIRED';
    }

    const items = db.prepare(`
      SELECT oi.*, pv.name as variant_name, pv.duration_days, pv.activation_guide,
             pv.warranty_duration_days, pv.estimated_delivery_text,
             p.title as product_title, p.platform_name, p.thumbnail_url
      FROM order_items oi
      JOIN product_variants pv ON oi.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id) as any[];

    // Check store settings
    const adminPhoneRow = db.prepare("SELECT value FROM store_settings WHERE key = 'admin_whatsapp'").get() as any;
    const storeStatusRow = db.prepare("SELECT value FROM store_settings WHERE key = 'store_status'").get() as any;
    const storeNoticeRow = db.prepare("SELECT value FROM store_settings WHERE key = 'operating_hours_notice'").get() as any;

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
    const sanitizedItems = items.map((item) => {
      const isFulfilled = order.payment_status === 'FULFILLED';
      return {
        id: item.id,
        product_title: item.product_title,
        platform_name: item.platform_name,
        variant_name: item.variant_name,
        duration_days: item.duration_days,
        unit_price: item.unit_price,
        estimated_delivery_text: item.estimated_delivery_text,
        activation_payload: isFulfilled ? item.activation_payload : null,
        admin_delivery_notes: isFulfilled ? item.admin_delivery_notes : null,
        activation_guide: isFulfilled ? item.activation_guide : null,
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
          admin_whatsapp: adminPhoneRow?.value || '6281234567890',
          is_sla_breached: elapsedMinutesSincePaid >= 20,
          store_status: storeStatusRow?.value || 'ONLINE',
          store_notice: storeNoticeRow?.value || '',
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
