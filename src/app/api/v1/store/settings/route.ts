import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET() {
  try {
    const { data: rows, error } = await supabase.from('store_settings').select('key, value');
    if (error) throw error;

    const map: Record<string, string> = {};
    (rows || []).forEach((r) => { map[r.key] = r.value; });

    return NextResponse.json({
      success: true,
      data: {
        store_status: map['store_status'] || 'ONLINE',
        operating_hours_notice: map['operating_hours_notice'] || '',
        whatsapp_cs_number: map['admin_whatsapp'] || '085183410190',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_GET_STORE_SETTINGS', message: error.message } },
      { status: 500 }
    );
  }
}
