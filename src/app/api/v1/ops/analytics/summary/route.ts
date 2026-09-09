import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch all orders with order_items
    const { data: allOrders, error } = await supabase
      .from('orders')
      .select('id, payment_status, paid_at, fulfillment_duration_seconds, order_items(unit_price, cost_price)');

    if (error) throw error;

    const orders = allOrders || [];

    let totalGmv = 0;
    let totalNetProfit = 0;
    let todayGmv = 0;
    let todayNetProfit = 0;

    let pendingFulfillment = 0;
    let fulfilledTotal = 0;
    let pendingPayment = 0;
    let refundedTotal = 0;
    let expiredTotal = 0;

    let measuredDurationSum = 0;
    let measuredCount = 0;
    let underSlaCount = 0;
    let breachedSlaCount = 0;

    for (const o of orders) {
      if (o.payment_status === 'PAID_PROCESSING') pendingFulfillment++;
      else if (o.payment_status === 'FULFILLED') fulfilledTotal++;
      else if (o.payment_status === 'PENDING_PAYMENT') pendingPayment++;
      else if (o.payment_status === 'REFUNDED') refundedTotal++;
      else if (o.payment_status === 'EXPIRED') expiredTotal++;

      if (o.payment_status === 'FULFILLED') {
        const isToday = o.paid_at && o.paid_at.startsWith(todayStr);

        for (const item of (o.order_items || [])) {
          const unit = Number(item.unit_price) || 0;
          const cost = Number(item.cost_price) || 0;
          const profit = unit - cost;

          totalGmv += unit;
          totalNetProfit += profit;

          if (isToday) {
            todayGmv += unit;
            todayNetProfit += profit;
          }
        }

        if (o.fulfillment_duration_seconds !== null && o.fulfillment_duration_seconds !== undefined) {
          const dur = Number(o.fulfillment_duration_seconds);
          measuredCount++;
          measuredDurationSum += dur;
          if (dur <= 1200) underSlaCount++;
          else breachedSlaCount++;
        }
      }
    }

    const avgSeconds = measuredCount > 0 ? Math.round(measuredDurationSum / measuredCount) : 0;
    const avgMinutes = Math.round(avgSeconds / 60);
    const slaComplianceRate = measuredCount > 0 ? Math.round((underSlaCount / measuredCount) * 100) : 100;

    return NextResponse.json({
      success: true,
      data: {
        currency: 'IDR',
        today: {
          date: todayStr,
          gmv: todayGmv,
          net_profit: todayNetProfit,
        },
        all_time: {
          gmv: totalGmv,
          net_profit: totalNetProfit,
        },
        orders: {
          pending_fulfillment: pendingFulfillment,
          fulfilled: fulfilledTotal,
          pending_payment: pendingPayment,
          refunded: refundedTotal,
          expired: expiredTotal,
        },
        sla_performance: {
          target_sla_minutes: 20,
          avg_fulfillment_seconds: avgSeconds,
          avg_fulfillment_minutes: avgMinutes,
          compliance_rate_percentage: slaComplianceRate,
          breached_count: breachedSlaCount,
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
