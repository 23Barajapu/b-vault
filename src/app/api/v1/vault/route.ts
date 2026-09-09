import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_EMAIL_REQUIRED', message: 'Email wajib diisi.' } },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const orders = db.prepare(`
      SELECT o.id, o.order_number, o.secure_token, o.customer_email, o.target_account_input,
             o.total_amount, o.payment_status, o.payment_method, o.paid_at, o.fulfilled_at, o.created_at
      FROM orders o
      WHERE o.customer_email = ? AND o.payment_status = 'FULFILLED'
      ORDER BY o.fulfilled_at DESC
    `).all(cleanEmail) as any[];

    const result = orders.map((order) => {
      const items = db.prepare(`
        SELECT oi.*, pv.name as variant_name, pv.duration_days, pv.activation_guide,
               pv.warranty_duration_days, p.title as product_title, p.platform_name
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id) as any[];

      return {
        order_number: order.order_number,
        secure_token: order.secure_token,
        target_account: order.target_account_input,
        fulfilled_at: order.fulfilled_at,
        items: items.map((item) => {
          let daysRemainingWarranty = 0;
          if (item.warranty_expired_at) {
            const exp = new Date(item.warranty_expired_at).getTime();
            daysRemainingWarranty = Math.max(0, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
          }

          return {
            product_title: item.product_title,
            platform_name: item.platform_name,
            variant_name: item.variant_name,
            activation_payload: item.activation_payload,
            admin_delivery_notes: item.admin_delivery_notes,
            activation_guide: item.activation_guide,
            warranty_expired_at: item.warranty_expired_at,
            warranty_days_left: daysRemainingWarranty,
          };
        }),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        email: cleanEmail,
        vault_items: result,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_VAULT_QUERY',
          message: error.message || 'Gagal mengambil arsip lisensi vault.',
        },
      },
      { status: 500 }
    );
  }
}
