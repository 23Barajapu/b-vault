import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// GET /api/v1/ops/products
// Mengambil semua kategori, produk, dan varian
export async function GET() {
  try {
    let { data: categories } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true });

    // Auto-seed default categories if empty so dropdown is never empty
    if (!categories || categories.length === 0) {
      const defaultCategories = [
        { name: 'AI & Machine Learning', slug: 'ai-machine-learning' },
        { name: 'Desain & Video', slug: 'desain-video' },
        { name: 'Produktivitas & Cloud', slug: 'produktivitas-cloud' },
        { name: 'Developer & Utility', slug: 'developer-utility' },
        { name: 'Lisensi & Akun Pro', slug: 'lisensi-pro' },
      ];
      await supabase.from('categories').upsert(defaultCategories, { onConflict: 'slug' });
      const { data: seeded } = await supabase.from('categories').select('*').order('id', { ascending: true });
      categories = seeded || [];
    }

    const { data: rawProducts } = await supabase
      .from('products')
      .select('*, categories:category_id(name, slug)')
      .order('title', { ascending: true });

    const { data: rawVariants } = await supabase
      .from('product_variants')
      .select('*')
      .order('product_id', { ascending: true });

    const variants = rawVariants || [];
    const productsWithVariants = (rawProducts || []).map((p: any) => ({
      ...p,
      category_name: p.categories?.name || '',
      category_slug: p.categories?.slug || '',
      variants: variants.filter((v: any) => v.product_id === p.id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        categories: categories || [],
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
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: name.trim(), slug: slug.trim().toLowerCase() })
        .select('id')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: { id: data.id } });
    }

    if (action === 'create_product') {
      const { category_id, title, slug, platform_name, description } = body;
      if (!title || !platform_name) {
        return NextResponse.json({ success: false, error: { message: 'Judul dan nama platform produk wajib diisi' } }, { status: 400 });
      }
      const safeSlug = slug ? slug.trim().toLowerCase() : title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await supabase
        .from('products')
        .insert({
          category_id: category_id ? Number(category_id) : null,
          title: title.trim(),
          slug: safeSlug,
          platform_name: platform_name.trim(),
          description: description ? description.trim() : '',
          is_active: 1,
        })
        .select('id')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: { id: data.id } });
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
        is_active,
      } = body;

      if (!product_id || !name || retail_price === undefined) {
        return NextResponse.json({ success: false, error: { message: 'Produk ID, nama varian, dan harga retail wajib diisi' } }, { status: 400 });
      }

      // Periksa status produk induk: jika produk non-aktif, paket otomatis non-aktif
      const { data: parentProduct } = await supabase
        .from('products')
        .select('is_active')
        .eq('id', Number(product_id))
        .single();

      const variantActiveStatus = (parentProduct && parentProduct.is_active === 0)
        ? 0
        : (is_active !== undefined ? Number(is_active) : 1);

      const { data, error } = await supabase
        .from('product_variants')
        .insert({
          product_id: Number(product_id),
          name: name.trim(),
          duration_days: Number(duration_days) || 30,
          cost_price: Number(cost_price) || 0,
          retail_price: Number(retail_price),
          input_requirement_label: input_requirement_label ? input_requirement_label.trim() : 'Email Akun Anda',
          estimated_delivery_text: estimated_delivery_text ? estimated_delivery_text.trim() : '5 - 20 Menit',
          warranty_duration_days: Number(warranty_duration_days) || Number(duration_days) || 30,
          activation_guide: activation_guide ? activation_guide.trim() : 'Ikuti link atau kredensial yang diserahkan admin di status pesanan.',
          is_active: variantActiveStatus,
        })
        .select('id')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: { id: data.id } });
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

      const updateObj: Record<string, any> = {};
      if (title !== undefined) updateObj.title = title.trim();
      if (platform_name !== undefined) updateObj.platform_name = platform_name.trim();
      if (description !== undefined) updateObj.description = description.trim();
      if (category_id !== undefined) updateObj.category_id = Number(category_id);

      if (is_active !== undefined) {
        const newActive = Number(is_active);
        updateObj.is_active = newActive;
        // Cascade sinkronisasi: saat status produk diubah, seluruh paket otomatis diselaraskan
        await supabase
          .from('product_variants')
          .update({ is_active: newActive })
          .eq('product_id', Number(id));
      }

      const { error } = await supabase.from('products').update(updateObj).eq('id', Number(id));
      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Produk dan paket berhasil diperbarui' });
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

      const updateObj: Record<string, any> = {};
      if (name !== undefined) updateObj.name = name.trim();
      if (duration_days !== undefined) updateObj.duration_days = Number(duration_days);
      if (cost_price !== undefined) updateObj.cost_price = Number(cost_price);
      if (retail_price !== undefined) updateObj.retail_price = Number(retail_price);
      if (input_requirement_label !== undefined) updateObj.input_requirement_label = input_requirement_label.trim();
      if (estimated_delivery_text !== undefined) updateObj.estimated_delivery_text = estimated_delivery_text.trim();
      if (warranty_duration_days !== undefined) updateObj.warranty_duration_days = Number(warranty_duration_days);
      if (activation_guide !== undefined) updateObj.activation_guide = activation_guide.trim();
      if (is_active !== undefined) updateObj.is_active = Number(is_active);

      const { error } = await supabase.from('product_variants').update(updateObj).eq('id', Number(id));
      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Varian berhasil diperbarui' });
    }

    if (target === 'category') {
      const { id, name, slug } = body;
      if (!id || !name) return NextResponse.json({ success: false, error: { message: 'ID dan nama kategori wajib disertakan' } }, { status: 400 });

      const safeSlug = slug ? slug.trim().toLowerCase() : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { error } = await supabase.from('categories').update({ name: name.trim(), slug: safeSlug }).eq('id', Number(id));
      if (error) throw error;

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
      const { error } = await supabase.from('products').delete().eq('id', Number(id));
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Produk berhasil dihapus' });
    }

    if (type === 'variant') {
      const { error } = await supabase.from('product_variants').delete().eq('id', Number(id));
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Varian berhasil dihapus' });
    }

    if (type === 'category') {
      const { error } = await supabase.from('categories').delete().eq('id', Number(id));
      if (error) throw error;
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
