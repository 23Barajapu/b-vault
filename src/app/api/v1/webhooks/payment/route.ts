import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dispatchTelegramAdminAlert } from '@/lib/dispatcher';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support both standardized webhook & direct simulator payload
    const orderNumber = body.order_number || body.order_id || body.external_id;
    const paymentStatus = body.status || body.transaction_status || 'PAID';

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NUMBER_REQUIRED', message: 'Nomor invoice diperlukan.' } },
        { status: 400 }
      );
    }

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) as any;
    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' } },
        { status: 404 }
      );
    }

    // Idempotency: if already paid/fulfilled, skip re-processing
    if (order.payment_status === 'PAID_PROCESSING' || order.payment_status === 'FULFILLED') {
      return NextResponse.json({
        success: true,
        message: 'Pesanan sudah diproses sebelumnya (Idempotent OK).',
        data: { order_number: order.order_number, payment_status: order.payment_status }
      });
    }

    // Check if status represents a successful payment
    const isPaid = ['PAID', 'settlement', 'capture', 'SUCCESS'].includes(paymentStatus);

    if (isPaid) {
      const nowIso = new Date().toISOString();
      db.prepare(`
        UPDATE orders
        SET payment_status = 'PAID_PROCESSING',
            paid_at = ?
        WHERE id = ?
      `).run(nowIso, order.id);

      // Fetch items for Telegram notification
      const items = db.prepare(`
        SELECT oi.*, pv.name as variant_name, p.title as product_title
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id) as any[];

      const firstItem = items[0] || { product_title: 'Lisensi Digital', variant_name: 'Standar' };

      // Dispatch alert to Telegram Bot Admin
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fulfillUrl = `${baseUrl}/admin?focus=${order.order_number}`;

      await dispatchTelegramAdminAlert(
        {
          orderNumber: order.order_number,
          productName: firstItem.product_title,
          variantName: firstItem.variant_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          targetAccount: order.target_account_input,
          totalAmount: order.total_amount,
          paidAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          fulfillUrl,
        },
        order.id
      );

      return NextResponse.json({
        success: true,
        message: 'Pembayaran berhasil diverifikasi. Alert Telegram telah ditembakkan.',
        data: {
          order_number: order.order_number,
          payment_status: 'PAID_PROCESSING',
          paid_at: nowIso,
        },
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Status pembayaran diterima namun belum lunas.',
        data: { order_number: order.order_number, status: paymentStatus },
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_WEBHOOK_FAILED',
          message: error.message || 'Gagal memproses webhook pembayaran.',
        },
      },
      { status: 500 }
    );
  }
}
