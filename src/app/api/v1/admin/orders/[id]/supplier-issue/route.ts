import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = Number(params.id);
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_INVALID_ID', message: 'ID pesanan tidak valid.' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action || 'TOGGLE_ISSUE'; // 'TOGGLE_ISSUE' | 'REFUND'

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' } },
        { status: 404 }
      );
    }

    if (action === 'REFUND') {
      db.prepare(`
        UPDATE orders
        SET payment_status = 'REFUNDED',
            supplier_issue = 0
        WHERE id = ?
      `).run(orderId);

      return NextResponse.json({
        success: true,
        message: 'Pesanan telah ditandai sebagai REFUNDED.',
        data: { order_id: orderId, payment_status: 'REFUNDED' },
      });
    } else {
      const newStatus = order.supplier_issue ? 0 : 1;
      db.prepare(`
        UPDATE orders
        SET supplier_issue = ?
        WHERE id = ?
      `).run(newStatus, orderId);

      return NextResponse.json({
        success: true,
        message: newStatus ? 'Kendala antrean supplier telah ditandai ke pelanggan.' : 'Kendala supplier dinonaktifkan.',
        data: { order_id: orderId, supplier_issue: Boolean(newStatus) },
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_SUPPLIER_ISSUE_ACTION',
          message: error.message || 'Gagal mengubah status kendala supplier.',
        },
      },
      { status: 500 }
    );
  }
}
