import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { dispatchTelegramAdminAlert } from '@/lib/dispatcher';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = Number(id);

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_ID', message: 'ID pesanan tidak valid.' } },
        { status: 400 }
      );
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' } },
        { status: 404 }
      );
    }

    const isTimeExpired = order.expired_at && new Date(order.expired_at).getTime() < Date.now();
    if (order.payment_status === 'EXPIRED' || isTimeExpired) {
      if (order.payment_status !== 'EXPIRED') {
        await supabase.from('orders').update({ payment_status: 'EXPIRED' }).eq('id', orderId);
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_ORDER_EXPIRED',
            message: 'Pesanan sudah kadaluarsa (expired) dan tidak dapat ditandai lunas.',
          },
        },
        { status: 400 }
      );
    }

    if (order.payment_status !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_INVALID_STATUS',
            message: `Pesanan dengan status ${order.payment_status} tidak dapat ditandai lunas.`,
          },
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID_PROCESSING',
        paid_at: nowIso,
      })
      .eq('id', orderId);

    if (updateErr) {
      throw updateErr;
    }

    // Kirim notifikasi Telegram ke Admin
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fulfillUrl = `${baseUrl}/ops?focus=${order.order_number}`;

      await dispatchTelegramAdminAlert(
        {
          orderNumber: order.order_number,
          productName: 'Lisensi Pro',
          variantName: 'Paket Lisensi',
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          targetAccount: order.target_account_input,
          totalAmount: order.total_amount,
          paidAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          fulfillUrl,
        },
        order.id
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Pesanan ${order.order_number} berhasil diverifikasi LUNAS.`,
      data: {
        id: order.id,
        order_number: order.order_number,
        payment_status: 'PAID_PROCESSING',
        paid_at: nowIso,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Gagal memverifikasi pembayaran pesanan' } },
      { status: 500 }
    );
  }
}
