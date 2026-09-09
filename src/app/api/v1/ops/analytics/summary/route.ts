import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Financial stats: GMV and Net Profit
    const financialStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN o.payment_status = 'FULFILLED' THEN oi.unit_price ELSE 0 END), 0) as total_gmv,
        COALESCE(SUM(CASE WHEN o.payment_status = 'FULFILLED' THEN (oi.unit_price - oi.cost_price) ELSE 0 END), 0) as total_net_profit,
        COALESCE(SUM(CASE WHEN o.payment_status = 'FULFILLED' AND o.paid_at LIKE ? THEN oi.unit_price ELSE 0 END), 0) as today_gmv,
        COALESCE(SUM(CASE WHEN o.payment_status = 'FULFILLED' AND o.paid_at LIKE ? THEN (oi.unit_price - oi.cost_price) ELSE 0 END), 0) as today_net_profit
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `).get(`${todayStr}%`, `${todayStr}%`) as any;

    // 2. Orders status count
    const statusCounts = db.prepare(`
      SELECT 
        SUM(CASE WHEN payment_status = 'PAID_PROCESSING' THEN 1 ELSE 0 END) as pending_fulfillment,
        SUM(CASE WHEN payment_status = 'FULFILLED' THEN 1 ELSE 0 END) as fulfilled_total,
        SUM(CASE WHEN payment_status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) as pending_payment,
        SUM(CASE WHEN payment_status = 'REFUNDED' THEN 1 ELSE 0 END) as refunded_total,
        SUM(CASE WHEN payment_status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_total
      FROM orders
    `).get() as any;

    // 3. SLA Fulfillment Performance
    const slaStats = db.prepare(`
      SELECT 
        COUNT(*) as total_measured,
        AVG(fulfillment_duration_seconds) as avg_duration_seconds,
        SUM(CASE WHEN fulfillment_duration_seconds <= 1200 THEN 1 ELSE 0 END) as under_sla_count,
        SUM(CASE WHEN fulfillment_duration_seconds > 1200 THEN 1 ELSE 0 END) as breached_sla_count
      FROM orders
      WHERE payment_status = 'FULFILLED' AND fulfillment_duration_seconds IS NOT NULL
    `).get() as any;

    const avgSeconds = Math.round(slaStats?.avg_duration_seconds || 0);
    const avgMinutes = Math.round(avgSeconds / 60);
    const measuredCount = slaStats?.total_measured || 0;
    const slaComplianceRate = measuredCount > 0
      ? Math.round(((slaStats?.under_sla_count || 0) / measuredCount) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      data: {
        currency: 'IDR',
        today: {
          date: todayStr,
          gmv: financialStats?.today_gmv || 0,
          net_profit: financialStats?.today_net_profit || 0,
        },
        all_time: {
          gmv: financialStats?.total_gmv || 0,
          net_profit: financialStats?.total_net_profit || 0,
        },
        orders: {
          pending_fulfillment: statusCounts?.pending_fulfillment || 0,
          fulfilled: statusCounts?.fulfilled_total || 0,
          pending_payment: statusCounts?.pending_payment || 0,
          refunded: statusCounts?.refunded_total || 0,
          expired: statusCounts?.expired_total || 0,
        },
        sla_performance: {
          target_sla_minutes: 20,
          avg_fulfillment_seconds: avgSeconds,
          avg_fulfillment_minutes: avgMinutes,
          compliance_rate_percentage: slaComplianceRate,
          breached_count: slaStats?.breached_sla_count || 0,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_ANALYTICS_FAILED', message: error.message || 'Gagal menghitung ringkasan analitik.' },
      },
      { status: 500 }
    );
  }
}
