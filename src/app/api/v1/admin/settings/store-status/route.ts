import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { getSystemParameters } from '@/lib/settings';

export async function GET() {
  try {
    const params = await getSystemParameters();

    // Fetch raw rows for backward compatibility
    const { data: rows } = await supabase.from('store_settings').select('key, value');
    const rawDict: Record<string, any> = {};
    for (const r of (rows || [])) {
      rawDict[r.key] = r.value;
    }

    // Merge raw with full typed parameters
    const merged = {
      ...rawDict,
      ...params,
      holiday_dates: Array.isArray(params.holiday_dates) ? params.holiday_dates.join(', ') : params.holiday_dates,
    };

    return NextResponse.json({
      success: true,
      data: merged,
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
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        let strVal = '';
        if (Array.isArray(value)) {
          strVal = value.join(', ');
        } else if (typeof value === 'boolean') {
          strVal = value ? 'true' : 'false';
        } else {
          strVal = String(value);
        }
        return { key, value: strVal };
      });

    if (entries.length > 0) {
      const { error } = await supabase.from('store_settings').upsert(entries, { onConflict: 'key' });
      if (error) throw error;
    }

    const updatedParams = await getSystemParameters();

    return NextResponse.json({
      success: true,
      message: 'Pengaturan dan parameter sistem berhasil diperbarui.',
      data: updatedParams,
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
