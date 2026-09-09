import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = Number(params.id);
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_ID', message: 'ID pesanan tidak valid.' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { activation_payload, admin_delivery_notes } = body;

    if (!activation_payload || activation_payload.trim().length < 5) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_INVALID_ACTIVATION_PAYLOAD',
            message: 'Tautan atau kredensial aktivasi wajib diisi minimal 5 karakter.',
          },
        },
        { status: 422 }
      );
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' } },
        { status: 404 }
      );
    }

    // Get order item to calculate warranty expiration
    const item = db.prepare(`
      SELECT oi.*, pv.warranty_duration_days
      FROM order_items oi
      JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE oi.order_id = ?
    `).get(orderId) as any;

    const warrantyDays = item?.warranty_duration_days || 30;
    const warrantyExpiredAt = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // Sanitize activation payload
    const sanitizedPayload = activation_payload.trim();
    const sanitizedNotes = admin_delivery_notes ? admin_delivery_notes.trim() : null;

    const fulfillmentDurationSeconds = order.paid_at
      ? Math.max(0, Math.floor((Date.now() - new Date(order.paid_at).getTime()) / 1000))
      : null;

    db.transaction(() => {
      // Update order item
      db.prepare(`
        UPDATE order_items
        SET activation_payload = ?,
            admin_delivery_notes = ?,
            warranty_expired_at = ?
        WHERE order_id = ?
      `).run(sanitizedPayload, sanitizedNotes, warrantyExpiredAt, orderId);

      // Update order status
      db.prepare(`
        UPDATE orders
        SET payment_status = 'FULFILLED',
            fulfilled_at = ?,
            fulfillment_duration_seconds = ?,
            supplier_issue = 0
        WHERE id = ?
      `).run(nowIso, fulfillmentDurationSeconds, orderId);

      // Log dispatcher fulfillment audit
      db.prepare(`
        INSERT INTO dispatcher_logs (order_id, channel, status, payload)
        VALUES (?, 'CUSTOMER_DELIVERY', 'SENT', ?)
      `).run(orderId, JSON.stringify({ fulfilled_at: nowIso, duration_seconds: fulfillmentDurationSeconds, hasNotes: Boolean(sanitizedNotes) }));
    })();

    return NextResponse.json({
      success: true,
      message: 'Lisensi berhasil diserahkan kepada pelanggan.',
      data: {
        order_id: orderId,
        order_number: order.order_number,
        payment_status: 'FULFILLED',
        fulfilled_at: nowIso,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_FULFILL_FAILED',
          message: error.message || 'Gagal menyerahkan lisensi.',
        },
      },
      { status: 500 }
    );
  }
}
