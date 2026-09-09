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
    ]);

    const categories = categoriesData || [];
    const rawProducts = productsData || [];
    const variants = variantsData || [];
    const settings = settingsData || [];

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
