import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'PENDING';

    let query = `
      SELECT o.*, 
        (SELECT json_group_array(
          json_object(
            'id', oi.id,
            'variant_id', oi.variant_id,
            'variant_name', pv.name,
            'product_title', p.title,
            'platform_name', p.platform_name,
            'unit_price', oi.unit_price,
            'activation_payload', oi.activation_payload,
            'admin_delivery_notes', oi.admin_delivery_notes,
            'activation_guide', pv.activation_guide,
            'warranty_days', pv.warranty_duration_days
          )
        ) FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = o.id) as items_json
      FROM orders o
    `;

    if (filter === 'PENDING') {
      query += ` WHERE o.payment_status = 'PAID_PROCESSING' ORDER BY o.paid_at ASC`;
    } else if (filter === 'FULFILLED') {
      query += ` WHERE o.payment_status = 'FULFILLED' ORDER BY o.fulfilled_at DESC LIMIT 50`;
    } else {
      query += ` ORDER BY o.id DESC LIMIT 50`;
    }

    const rows = db.prepare(query).all() as any[];

    const orders = rows.map((r) => {
      let items = [];
      try {
        items = JSON.parse(r.items_json);
      } catch {
        items = [];
      }

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

    // Summary statistics
    const statsRow = db.prepare(`
      SELECT 
        SUM(CASE WHEN payment_status = 'PAID_PROCESSING' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN payment_status = 'FULFILLED' THEN 1 ELSE 0 END) as fulfilled_count,
        SUM(CASE WHEN payment_status IN ('PAID_PROCESSING', 'FULFILLED') THEN total_amount ELSE 0 END) as total_gmv
      FROM orders
    `).get() as any;

    const storeStatusRow = db.prepare("SELECT value FROM store_settings WHERE key = 'store_status'").get() as any;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          pending_fulfillment: statsRow?.pending_count || 0,
          fulfilled_total: statsRow?.fulfilled_count || 0,
          total_revenue: statsRow?.total_gmv || 0,
          store_status: storeStatusRow?.value || 'ONLINE',
        },
        orders,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_FETCH_ADMIN_ORDERS',
          message: error.message || 'Gagal mengambil antrean order admin.',
        },
      },
      { status: 500 }
    );
  }
}
