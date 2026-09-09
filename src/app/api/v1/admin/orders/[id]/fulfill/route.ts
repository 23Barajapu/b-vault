import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

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

    // Get order item to calculate warranty expiration
    const { data: items } = await supabase
      .from('order_items')
      .select('id, product_variants(warranty_duration_days)')
      .eq('order_id', orderId);

    const firstItem: any = items?.[0];
    const warrantyDays = firstItem?.product_variants?.warranty_duration_days || 30;
    const warrantyExpiredAt = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const sanitizedPayload = activation_payload.trim();
    const sanitizedNotes = admin_delivery_notes ? admin_delivery_notes.trim() : null;

    const fulfillmentDurationSeconds = order.paid_at
      ? Math.max(0, Math.floor((Date.now() - new Date(order.paid_at).getTime()) / 1000))
      : null;

    // Update order item in Supabase
    await supabase
      .from('order_items')
      .update({
        activation_payload: sanitizedPayload,
        admin_delivery_notes: sanitizedNotes,
        warranty_expired_at: warrantyExpiredAt,
      })
      .eq('order_id', orderId);

    // Update order in Supabase
    await supabase
      .from('orders')
      .update({
        payment_status: 'FULFILLED',
        fulfilled_at: nowIso,
        fulfillment_duration_seconds: fulfillmentDurationSeconds,
        supplier_issue: 0,
      })
      .eq('id', orderId);

    // Record dispatcher log
    await supabase.from('dispatcher_logs').insert({
      order_id: orderId,
      channel: 'CUSTOMER_DELIVERY',
      status: 'SENT',
      payload: JSON.stringify({ fulfilled_at: nowIso, duration_seconds: fulfillmentDurationSeconds, hasNotes: Boolean(sanitizedNotes) }),
    });

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
        error: { code: 'ERR_FULFILL_FAILED', message: error.message || 'Gagal memproses penyerahan lisensi.' },
      },
      { status: 500 }
    );
  }
}
