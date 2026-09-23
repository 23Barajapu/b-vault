import { NextResponse } from 'next/server';
import { getSystemParameters, isStoreOperational } from '@/lib/settings';

export async function GET() {
  try {
    const params = await getSystemParameters();
    const operational = isStoreOperational(params);

    return NextResponse.json({
      success: true,
      data: {
        operational,
        session_idle_timeout_minutes: params.session_idle_timeout_minutes,
        payment_expiry_minutes: params.payment_expiry_minutes,
        admin_whatsapp: params.admin_whatsapp,
        operating_hours_notice: params.operating_hours_notice,
        baseline_delivered_licenses: params.baseline_delivered_licenses,
        promo_enabled: params.promo_enabled,
        promo_code: params.promo_code,
        promo_discount_percent: params.promo_discount_percent,
        promo_min_order_amount: params.promo_min_order_amount,
        promo_banner_active: params.promo_banner_active,
        promo_banner_text: params.promo_banner_text,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_GET_PUBLIC_SETTINGS', message: error.message },
      },
      { status: 500 }
    );
  }
}
