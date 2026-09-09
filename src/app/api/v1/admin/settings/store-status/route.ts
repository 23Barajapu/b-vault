import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET() {
  try {
    const { data: rows, error } = await supabase.from('store_settings').select('key, value');
    if (error) throw error;

    const settings: Record<string, string> = {};
    for (const r of (rows || [])) {
      settings[r.key] = r.value;
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_GET_SETTINGS', message: error.message },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries = Object.entries(body)
      .filter(([_, value]) => typeof value === 'string')
      .map(([key, value]) => ({ key, value: value as string }));

    if (entries.length > 0) {
      const { error } = await supabase.from('store_settings').upsert(entries, { onConflict: 'key' });
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Pengaturan toko berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_UPDATE_SETTINGS', message: error.message },
      },
      { status: 500 }
    );
  }
}
