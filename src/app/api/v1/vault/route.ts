import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

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

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        secure_token,
        customer_email,
        target_account_input,
        total_amount,
        payment_status,
        payment_method,
        paid_at,
        fulfilled_at,
        expired_at,
        created_at,
        order_items (
          id,
          unit_price,
          activation_payload,
          admin_delivery_notes,
          warranty_expired_at,
          product_variants (
            name,
            duration_days,
            activation_guide,
            warranty_duration_days,
            products (
              title,
              platform_name
            )
          )
        )
      `)
      .eq('customer_email', cleanEmail)
      .order('created_at', { ascending: false });

    if (ordersErr) throw ordersErr;

    const result = (orders || []).map((order: any) => {
      const items = order.order_items || [];

      return {
        order_number: order.order_number,
        secure_token: order.secure_token,
        target_account: order.target_account_input,
        payment_status: order.payment_status,
        total_amount: Number(order.total_amount) || 0,
        payment_method: order.payment_method || 'QRIS',
        created_at: order.created_at,
        paid_at: order.paid_at,
        fulfilled_at: order.fulfilled_at,
        expired_at: order.expired_at,
        items: items.map((item: any) => {
          const variant = item.product_variants;
          const product = variant?.products;
          const isLifetimeWarranty = variant?.warranty_duration_days === 0 || Number(variant?.warranty_duration_days) >= 9999;

          let daysRemainingWarranty = 0;
          if (isLifetimeWarranty) {
            daysRemainingWarranty = 99999;
          } else if (item.warranty_expired_at) {
            const exp = new Date(item.warranty_expired_at).getTime();
            daysRemainingWarranty = Math.max(0, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
          }

          return {
            product_title: product?.title || 'Lisensi Pro',
            platform_name: product?.platform_name || '',
            variant_name: variant?.name || '',
            is_lifetime_warranty: isLifetimeWarranty,
            activation_payload: item.activation_payload,
            admin_delivery_notes: item.admin_delivery_notes,
            activation_guide: variant?.activation_guide,
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
