import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.id ASC
    `).all() as any[];

    const variants = db.prepare(`
      SELECT * FROM product_variants
      WHERE is_active = 1
      ORDER BY retail_price ASC
    `).all() as any[];

    // Attach variants to products
    const productsWithVariants = products.map((p) => ({
      ...p,
      variants: variants.filter((v) => v.product_id === p.id),
    }));

    // Get store status
    const storeStatusRow = db.prepare("SELECT value FROM store_settings WHERE key = 'store_status'").get() as any;
    const storeNoticeRow = db.prepare("SELECT value FROM store_settings WHERE key = 'operating_hours_notice'").get() as any;

    return NextResponse.json({
      success: true,
      data: {
        store: {
          status: storeStatusRow?.value || 'ONLINE',
          notice: storeNoticeRow?.value || '',
        },
        categories,
        products: productsWithVariants,
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
