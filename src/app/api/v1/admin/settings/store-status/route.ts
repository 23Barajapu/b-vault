import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const rows = db.prepare('SELECT key, value FROM store_settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
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
    const updateStmt = db.prepare(`
      INSERT INTO store_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    db.transaction(() => {
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          updateStmt.run(key, value);
        }
      }
    })();

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
