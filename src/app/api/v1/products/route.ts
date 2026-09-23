import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET() {
  try {
    const [
      { data: categoriesData },
      { data: productsData },
      { data: variantsData },
      { data: settingsData },
      { data: recentOrdersData },
      { count: fulfilledCountData },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('id', { ascending: true }),
      supabase.from('products').select('*, categories:category_id(name, slug)').eq('is_active', 1).order('title', { ascending: true }),
      supabase.from('product_variants').select('*').eq('is_active', 1).order('retail_price', { ascending: true }),
      supabase.from('store_settings').select('*'),
      supabase
        .from('orders')
        .select(`
          customer_name,
          customer_email,
          paid_at,
          created_at,
          order_items (
            product_variants (
              name,
              products (
                title
              )
            )
          )
        `)
        .in('payment_status', ['PAID', 'FULFILLED'])
        .order('id', { ascending: false })
        .limit(8),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('payment_status', ['PAID', 'FULFILLED']),
    ]);

    const categories = categoriesData || [];
    const rawProducts = productsData || [];
    const variants = variantsData || [];
    const settings = settingsData || [];

    // Delivered licenses calculation: baseline (default 50) + fulfilled/paid orders count
    const rawBaseline = settings.find((s: any) => s.key === 'baseline_delivered_licenses')?.value;
    const baseline = rawBaseline ? parseInt(rawBaseline, 10) || 50 : 50;
    const fulfilledCount = fulfilledCountData || 0;
    const deliveredLicenses = baseline + fulfilledCount;

    // Map products with category names and variants
    const productsWithVariants = rawProducts.map((p: any) => {
      const cat = p.categories;
      return {
        ...p,
        category_name: cat?.name || '',
        category_slug: cat?.slug || '',
        variants: variants.filter((v: any) => v.product_id === p.id),
      };
    });

    // Store settings
    const storeStatus = settings.find((s) => s.key === 'store_status')?.value || 'ONLINE';
    const storeNotice = settings.find((s) => s.key === 'operating_hours_notice')?.value || '';

    // Promo settings
    const promoEnabled = settings.find((s) => s.key === 'promo_enabled')?.value !== 'false';
    const promoCode = (settings.find((s) => s.key === 'promo_code')?.value || 'BVAULTHEMAT').trim().toUpperCase();
    const promoDiscountPercent = parseInt(settings.find((s) => s.key === 'promo_discount_percent')?.value || '10', 10) || 10;
    const promoMinOrderAmount = parseInt(settings.find((s) => s.key === 'promo_min_order_amount')?.value || '0', 10) || 0;
    const promoBannerActive = settings.find((s) => s.key === 'promo_banner_active')?.value === 'true' || settings.find((s) => s.key === 'promo_banner_active')?.value === '1';
    const promoBannerText = settings.find((s) => s.key === 'promo_banner_text')?.value || '🔥 Promo Spesial: Gunakan kode kupon BVAULTHEMAT untuk diskon 10%!';

    // Active coupons list
    let activeCoupons: any[] = [];
    const rawCoupons = settings.find((s) => s.key === 'promo_coupons_list')?.value;
    if (rawCoupons) {
      try {
        const parsed = JSON.parse(rawCoupons);
        if (Array.isArray(parsed)) {
          activeCoupons = parsed.filter((c: any) => c.is_active);
        }
      } catch {}
    }
    if (activeCoupons.length === 0) {
      activeCoupons = [
        { id: 'default_1', code: promoCode, discount_type: 'PERCENT', discount_value: promoDiscountPercent, min_order_amount: promoMinOrderAmount, is_active: true }
      ];
    }

    // Real activities from paid orders
    const activities = (recentOrdersData || []).map((o: any) => {
      const rawName = (o.customer_name || o.customer_email || 'Pelanggan').trim();
      let displayName = 'Pelanggan';
      if (rawName.includes('@')) {
        const [user, domain] = rawName.split('@');
        displayName = `${user.slice(0, 2)}***@${domain}`;
      } else {
        const parts = rawName.split(' ');
        displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
      }

      const firstItem = o.order_items?.[0];
      const variant = firstItem?.product_variants;
      const productTitle = variant?.products?.title || 'Lisensi Pro';
      const variantName = variant?.name || 'Akses Resmi';

      return `${displayName} baru saja mengaktifkan ${productTitle} (${variantName})`;
    });

    return NextResponse.json({
      success: true,
      data: {
        store: {
          status: storeStatus,
          notice: storeNotice,
        },
        promo: {
          enabled: promoEnabled,
          code: promoCode,
          discount_percent: promoDiscountPercent,
          min_order_amount: promoMinOrderAmount,
          banner_active: promoBannerActive,
          banner_text: promoBannerText,
          coupons: activeCoupons,
        },
        delivered_licenses: deliveredLicenses,
        categories,
        products: productsWithVariants,
        activities,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_FETCH_PRODUCTS',
          message: error.message || 'Gagal mengambil katalog produk',
        },
      },
      { status: 500 }
    );
  }
}
