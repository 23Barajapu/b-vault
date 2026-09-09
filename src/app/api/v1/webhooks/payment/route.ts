import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { dispatchTelegramAdminAlert } from '@/lib/dispatcher';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderNumber = body.order_number || body.order_id || body.external_id;
    const paymentStatus = body.status || body.transaction_status || 'PAID';

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NUMBER_REQUIRED', message: 'Nomor invoice diperlukan.' } },
        { status: 400 }
      );
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderErr || !order) {
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

    // Auto-cancel check: if expired or past expired_at
    const isTimeExpired = order.expired_at && new Date(order.expired_at).getTime() < Date.now();
    if (order.payment_status === 'EXPIRED' || (order.payment_status === 'PENDING_PAYMENT' && isTimeExpired)) {
      if (order.payment_status === 'PENDING_PAYMENT') {
        await supabase.from('orders').update({ payment_status: 'EXPIRED' }).eq('id', order.id);
      }
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_EXPIRED', message: 'Pesanan otomatis dibatalkan karena tidak dibayar dalam 10 menit.' } },
        { status: 400 }
      );
    }

    // Check if status represents a successful payment
    const isPaid = ['PAID', 'settlement', 'capture', 'SUCCESS'].includes(paymentStatus);

    if (isPaid) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('orders')
        .update({
          payment_status: 'PAID_PROCESSING',
          paid_at: nowIso,
        })
        .eq('id', order.id);

      // Fetch items for Telegram notification
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          *,
          product_variants (
            name,
            products (
              title
            )
          )
        `)
        .eq('order_id', order.id);

      const firstItem = items?.[0];
      const variant = firstItem?.product_variants;
      const product = variant?.products;

      // Dispatch alert to Telegram Bot Admin
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fulfillUrl = `${baseUrl}/ops?focus=${order.order_number}`;

      await dispatchTelegramAdminAlert(
        {
          orderNumber: order.order_number,
          productName: product?.title || 'Lisensi Digital',
          variantName: variant?.name || 'Standar',
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
