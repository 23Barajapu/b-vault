import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'PENDING';

    // Auto-expire check: bersihkan pesanan yang tidak dibayar dalam 10 menit
    const nowIso = new Date().toISOString();
    const { data: expiredOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_status', 'PENDING_PAYMENT')
      .lt('expired_at', nowIso);

    if (expiredOrders && expiredOrders.length > 0) {
      const ids = expiredOrders.map((o: any) => o.id);
      await supabase.from('orders').update({ payment_status: 'EXPIRED' }).in('id', ids);
    }

    let query = supabase.from('orders').select(`
      *,
      order_items (
        id,
        variant_id,
        unit_price,
        activation_payload,
        admin_delivery_notes,
        product_variants (
          name,
          activation_guide,
          warranty_duration_days,
          products (
            title,
            platform_name
          )
        )
      )
    `);

    if (filter === 'PENDING') {
      query = query.eq('payment_status', 'PAID_PROCESSING').order('paid_at', { ascending: true });
    } else if (filter === 'FULFILLED') {
      query = query.eq('payment_status', 'FULFILLED').order('fulfilled_at', { ascending: false }).limit(50);
    } else {
      query = query.order('id', { ascending: false }).limit(50);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const orders = (rows || []).map((r: any) => {
      const items = (r.order_items || []).map((oi: any) => {
        const variant = oi.product_variants;
        const product = variant?.products;
        return {
          id: oi.id,
          variant_id: oi.variant_id,
          variant_name: variant?.name || '',
          product_title: product?.title || 'Lisensi Pro',
          platform_name: product?.platform_name || '',
          unit_price: oi.unit_price,
          activation_payload: oi.activation_payload,
          admin_delivery_notes: oi.admin_delivery_notes,
          activation_guide: variant?.activation_guide,
          warranty_days: variant?.warranty_duration_days,
        };
      });

      let elapsedMinutes = 0;
      if (r.paid_at) {
        elapsedMinutes = Math.floor((Date.now() - new Date(r.paid_at).getTime()) / (60 * 1000));
      }

      return {
        id: r.id,
        order_number: r.order_number,
        secure_token: r.secure_token,
        customer_email: r.customer_email,
        customer_phone: r.customer_phone,
        target_account_input: r.target_account_input,
        total_amount: r.total_amount,
        payment_status: r.payment_status,
        payment_method: r.payment_method,
        paid_at: r.paid_at,
        fulfilled_at: r.fulfilled_at,
        created_at: r.created_at,
        supplier_issue: Boolean(r.supplier_issue),
        elapsed_minutes: elapsedMinutes,
        is_sla_warning: elapsedMinutes >= 15 && r.payment_status === 'PAID_PROCESSING',
        is_sla_breached: elapsedMinutes >= 20 && r.payment_status === 'PAID_PROCESSING',
        items,
      };
    });

    // Summary statistics from Supabase
    const { data: allOrderStats } = await supabase
      .from('orders')
      .select('payment_status, total_amount');

    let pendingCount = 0;
    let fulfilledCount = 0;
    let totalGmv = 0;

    for (const o of (allOrderStats || [])) {
      if (o.payment_status === 'PAID_PROCESSING') {
        pendingCount++;
        totalGmv += Number(o.total_amount) || 0;
      } else if (o.payment_status === 'FULFILLED') {
        fulfilledCount++;
        totalGmv += Number(o.total_amount) || 0;
      }
    }

    const { data: storeSetting } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'store_status')
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          pending_fulfillment: pendingCount,
          fulfilled_total: fulfilledCount,
          total_revenue: totalGmv,
          store_status: storeSetting?.value || 'ONLINE',
        },
        orders,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_GET_PENDING_ORDERS', message: error.message || 'Gagal memuat pesanan pending.' },
      },
      { status: 500 }
    );
  }
}
