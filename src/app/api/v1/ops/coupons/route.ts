import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { getSystemParameters, PromoCoupon, DEFAULT_PARAMETERS } from '@/lib/settings';

export async function GET() {
  try {
    const params = await getSystemParameters();
    return NextResponse.json({
      success: true,
      data: {
        coupons: params.promo_coupons,
        promo_enabled: params.promo_enabled,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_GET_COUPONS', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, coupon, coupons } = body;

    const params = await getSystemParameters();
    let currentList: PromoCoupon[] = [...params.promo_coupons];

    if (action === 'REPLACE_ALL' && Array.isArray(coupons)) {
      currentList = coupons;
    } else if (action === 'UPSERT' && coupon) {
      const cleanCode = (coupon.code || '').trim().toUpperCase();
      if (!cleanCode) {
        return NextResponse.json(
          { success: false, error: { code: 'ERR_INVALID_CODE', message: 'Kode kupon wajib diisi.' } },
          { status: 400 }
        );
      }

      const existingIndex = currentList.findIndex(
        (c) => c.id === coupon.id || c.code.toUpperCase() === cleanCode
      );

      const targetCoupon: PromoCoupon = {
        id: coupon.id || `cp_${Date.now()}`,
        code: cleanCode,
        discount_type: coupon.discount_type === 'FIXED' ? 'FIXED' : 'PERCENT',
        discount_value: Math.max(1, Number(coupon.discount_value) || 10),
        min_order_amount: Math.max(0, Number(coupon.min_order_amount) || 0),
        max_discount_amount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
        is_active: coupon.is_active !== undefined ? Boolean(coupon.is_active) : true,
        notes: coupon.notes || '',
        created_at: coupon.created_at || new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        currentList[existingIndex] = targetCoupon;
      } else {
        currentList.unshift(targetCoupon);
      }
    } else if (action === 'DELETE' && body.id) {
      currentList = currentList.filter((c) => c.id !== body.id);
    } else if (action === 'TOGGLE' && body.id) {
      currentList = currentList.map((c) => (c.id === body.id ? { ...c, is_active: !c.is_active } : c));
    }

    // Persist to store_settings
    const { error: upsertErr } = await supabase.from('store_settings').upsert({
      key: 'promo_coupons_list',
      value: JSON.stringify(currentList),
    });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      success: true,
      data: {
        coupons: currentList,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_SAVE_COUPONS', message: error.message } },
      { status: 500 }
    );
  }
}
