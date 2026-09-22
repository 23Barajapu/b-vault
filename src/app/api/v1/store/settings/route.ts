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
