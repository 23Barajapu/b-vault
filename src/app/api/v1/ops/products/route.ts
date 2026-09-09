import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/v1/ops/products
// Mengambil semua kategori, produk, dan varian
export async function GET() {
  try {
    let categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all() as any[];

    // Auto-seed default categories if empty so dropdown is never empty
    if (categories.length === 0) {
      const defaultCategories = [
        { name: 'AI & Machine Learning', slug: 'ai-machine-learning' },
        { name: 'Desain & Video', slug: 'desain-video' },
        { name: 'Produktivitas & Cloud', slug: 'produktivitas-cloud' },
        { name: 'Developer & Utility', slug: 'developer-utility' },
      ];
      const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)');
      for (const cat of defaultCategories) {
        insertCat.run(cat.name, cat.slug);
      }
      categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all() as any[];
    }

    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id DESC
    `).all() as any[];

    const variants = db.prepare(`
      SELECT * FROM product_variants
      ORDER BY product_id ASC, retail_price ASC
    `).all() as any[];

    const productsWithVariants = products.map((p) => ({
      ...p,
      variants: variants.filter((v) => v.product_id === p.id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        categories,
        products: productsWithVariants,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Gagal memuat produk' } },
      { status: 500 }
    );
  }
}

// POST /api/v1/ops/products
// Menambah produk baru atau varian baru
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_category') {
      const { name, slug } = body;
      if (!name || !slug) {
        return NextResponse.json({ success: false, error: { message: 'Nama dan slug kategori wajib diisi' } }, { status: 400 });
      }
      const stmt = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
      const res = stmt.run(name.trim(), slug.trim().toLowerCase());
      return NextResponse.json({ success: true, data: { id: res.lastInsertRowid } });
    }

    if (action === 'create_product') {
      const { category_id, title, slug, platform_name, description } = body;
      if (!title || !platform_name) {
        return NextResponse.json({ success: false, error: { message: 'Judul dan nama platform produk wajib diisi' } }, { status: 400 });
      }
      const safeSlug = slug ? slug.trim().toLowerCase() : title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const stmt = db.prepare(`
        INSERT INTO products (category_id, title, slug, platform_name, description, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      const res = stmt.run(
        category_id ? Number(category_id) : 1,
        title.trim(),
        safeSlug,
        platform_name.trim(),
        description ? description.trim() : ''
      );
      return NextResponse.json({ success: true, data: { id: res.lastInsertRowid } });
    }

    if (action === 'create_variant') {
      const {
        product_id,
        name,
        duration_days,
        cost_price,
        retail_price,
        input_requirement_label,
        estimated_delivery_text,
        warranty_duration_days,
        activation_guide,
      } = body;

      if (!product_id || !name || retail_price === undefined) {
        return NextResponse.json({ success: false, error: { message: 'Produk ID, nama varian, dan harga retail wajib diisi' } }, { status: 400 });
      }

      const stmt = db.prepare(`
        INSERT INTO product_variants 
        (product_id, name, duration_days, cost_price, retail_price, input_requirement_label, estimated_delivery_text, warranty_duration_days, activation_guide, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      const res = stmt.run(
        Number(product_id),
        name.trim(),
        Number(duration_days) || 30,
        Number(cost_price) || 0,
        Number(retail_price),
        input_requirement_label ? input_requirement_label.trim() : 'Email Akun Anda',
        estimated_delivery_text ? estimated_delivery_text.trim() : '5 - 20 Menit',
        Number(warranty_duration_days) || Number(duration_days) || 30,
        activation_guide ? activation_guide.trim() : 'Ikuti link atau kredensial yang diserahkan admin di status pesanan.'
      );

      return NextResponse.json({ success: true, data: { id: res.lastInsertRowid } });
    }

    return NextResponse.json({ success: false, error: { message: 'Aksi tidak dikenali' } }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Gagal menyimpan data produk' } },
      { status: 500 }
    );
  }
}

// PUT /api/v1/ops/products
// Mengupdate produk atau varian
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { target } = body;

    if (target === 'product') {
      const { id, title, platform_name, description, category_id, is_active } = body;
      if (!id) return NextResponse.json({ success: false, error: { message: 'ID produk wajib disertakan' } }, { status: 400 });

      const stmt = db.prepare(`
        UPDATE products 
        SET title = COALESCE(?, title),
            platform_name = COALESCE(?, platform_name),
            description = COALESCE(?, description),
            category_id = COALESCE(?, category_id),
            is_active = COALESCE(?, is_active)
        WHERE id = ?
      `);
      stmt.run(
        title ? title.trim() : null,
        platform_name ? platform_name.trim() : null,
        description !== undefined ? description.trim() : null,
        category_id !== undefined ? Number(category_id) : null,
        is_active !== undefined ? Number(is_active) : null,
        Number(id)
      );

      return NextResponse.json({ success: true, message: 'Produk berhasil diperbarui' });
    }

    if (target === 'variant') {
      const {
        id,
        name,
        duration_days,
        cost_price,
        retail_price,
        input_requirement_label,
        estimated_delivery_text,
        warranty_duration_days,
        activation_guide,
        is_active,
      } = body;

      if (!id) return NextResponse.json({ success: false, error: { message: 'ID varian wajib disertakan' } }, { status: 400 });

      const stmt = db.prepare(`
        UPDATE product_variants
        SET name = COALESCE(?, name),
            duration_days = COALESCE(?, duration_days),
            cost_price = COALESCE(?, cost_price),
            retail_price = COALESCE(?, retail_price),
            input_requirement_label = COALESCE(?, input_requirement_label),
            estimated_delivery_text = COALESCE(?, estimated_delivery_text),
            warranty_duration_days = COALESCE(?, warranty_duration_days),
            activation_guide = COALESCE(?, activation_guide),
            is_active = COALESCE(?, is_active)
        WHERE id = ?
      `);

      stmt.run(
        name !== undefined ? name.trim() : null,
        duration_days !== undefined ? Number(duration_days) : null,
        cost_price !== undefined ? Number(cost_price) : null,
        retail_price !== undefined ? Number(retail_price) : null,
        input_requirement_label !== undefined ? input_requirement_label.trim() : null,
        estimated_delivery_text !== undefined ? estimated_delivery_text.trim() : null,
        warranty_duration_days !== undefined ? Number(warranty_duration_days) : null,
        activation_guide !== undefined ? activation_guide.trim() : null,
        is_active !== undefined ? Number(is_active) : null,
        Number(id)
      );

      return NextResponse.json({ success: true, message: 'Varian berhasil diperbarui' });
    }

    if (target === 'category') {
      const { id, name, slug } = body;
      if (!id || !name) return NextResponse.json({ success: false, error: { message: 'ID dan nama kategori wajib disertakan' } }, { status: 400 });

      const safeSlug = slug ? slug.trim().toLowerCase() : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const stmt = db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?');
      stmt.run(name.trim(), safeSlug, Number(id));

      return NextResponse.json({ success: true, message: 'Kategori berhasil diperbarui' });
    }

    return NextResponse.json({ success: false, error: { message: 'Target update tidak valid' } }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Gagal memperbarui data' } },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/ops/products
// Menghapus produk, varian, atau kategori
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!id || !type) {
      return NextResponse.json({ success: false, error: { message: 'Tipe dan ID wajib disertakan' } }, { status: 400 });
    }

    if (type === 'product') {
      db.prepare('DELETE FROM products WHERE id = ?').run(Number(id));
      return NextResponse.json({ success: true, message: 'Produk berhasil dihapus' });
    }

    if (type === 'variant') {
      db.prepare('DELETE FROM product_variants WHERE id = ?').run(Number(id));
      return NextResponse.json({ success: true, message: 'Varian berhasil dihapus' });
    }

    if (type === 'category') {
      db.prepare('DELETE FROM categories WHERE id = ?').run(Number(id));
      return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus' });
    }

    return NextResponse.json({ success: false, error: { message: 'Tipe hapus tidak valid' } }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Gagal menghapus data' } },
      { status: 500 }
    );
  }
}
