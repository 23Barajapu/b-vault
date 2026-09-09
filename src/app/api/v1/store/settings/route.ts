import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const storeStatusRow = db.prepare("SELECT value FROM store_settings WHERE key = 'store_status'").get() as any;
    const storeNoticeRow = db.prepare("SELECT value FROM store_settings WHERE key = 'operating_hours_notice'").get() as any;
    const adminPhoneRow = db.prepare("SELECT value FROM store_settings WHERE key = 'admin_whatsapp'").get() as any;

    return NextResponse.json({
      success: true,
      data: {
        store_status: storeStatusRow?.value || 'ONLINE',
        operating_hours_notice: storeNoticeRow?.value || '',
        whatsapp_cs_number: adminPhoneRow?.value || '085183410190',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_GET_STORE_SETTINGS', message: error.message } },
      { status: 500 }
    );
  }
}
