# B-Vault

Platform e-commerce reseller lisensi pro dan akun digital berbasis Next.js 14 App Router dan Supabase PostgreSQL. Dirancang dengan arsitektur hybrid on-demand untuk mengotomasi alur checkout, verifikasi pembayaran, notifikasi dispatcher admin, konsol pemenuhan (ops desk) ramah perangkat seluler, serta brankas lisensi mandiri bagi pelanggan (*Customer Vault*).

---

## Gambaran Alur Sistem

1. **Katalog & Checkout Cepat**: Pembeli memilih varian produk (Canva Pro, ChatGPT Plus, Claude Pro, Google One, dsb.) dengan opsi durasi/garansi fleksibel (termasuk durasi *Lifetime*).
2. **Otomasi Pembayaran & Batas Waktu**: Tagihan instan via QRIS Dinamis/Statis Nasional dan Virtual Account Multi-Bank. Pesanan otomatis kedaluwarsa (*Auto-Expired*) jika tidak dibayar dalam 10 menit.
3. **Internal Dispatcher**: Pembayaran terverifikasi memicu notifikasi instan ke bot Telegram admin/operator lengkap dengan tautan akses ke konsol pemenuhan.
4. **Quick Fulfillment (Ops Desk)**: Operator menempelkan kredensial atau tautan lisensi langsung dari smartphone di `/ops`. Layar pesanan pelanggan diperbarui secara real-time.
5. **Customer License Vault**: Pelanggan dapat melihat seluruh riwayat lisensi yang pernah dibeli berdasarkan email dengan tab filter *Semua*, *Lunas (Lisensi Aktif)*, dan *Belum Dibayar*.
6. **Statistik Lisensi Terkirim Dinamis**: Counter statistik di halaman utama memiliki baseline awal 50+ dan otomatis bertambah setiap kali pesanan diselesaikan (`FULFILLED`).

---

## Tumpukan Teknologi

- **Framework**: Next.js 14 (App Router) & TypeScript.
- **Basis Data**: Supabase (PostgreSQL Cloud) kompatibel dengan Edge Runtime & Node.js.
- **Deployment**: Mendukung Node.js Server, Vercel, dan Cloudflare Pages via `@opennextjs/cloudflare`.
- **Desain UI**: Vanilla CSS bertema Dark Luxury Metallic Gold, kepatuhan aksesibilitas WCAG AA, rasio kontras tinggi, dan tap target ramah sentuhan mobile (≥44px).
- **Format Angka**: Standarisasi format pemisah ribuan Indonesia (`toLocaleString('id-ID')`) untuk seluruh harga, SLA menit/detik, dan counter statistik.

---

## Struktur Direktori

```
jualan/
├── src/
│   ├── app/
│   │   ├── api/v1/                   # REST API Endpoint
│   │   │   ├── admin/                # Route pemenuhan, analitik, dan pengaturan admin
│   │   │   ├── auth/                 # Google OAuth dan session handler
│   │   │   ├── ops/                  # Route operasi toko dan fulfillment
│   │   │   ├── orders/               # Route checkout dan cek status pesanan
│   │   │   ├── products/             # Route katalog dan statistik toko
│   │   │   ├── vault/                # Route customer license vault
│   │   │   └── webhooks/             # Webhook payment gateway idempoten
│   │   ├── orders/[orderNumber]/     # Halaman live stepper status pesanan pelanggan
│   │   ├── ops/                      # B-Vault Operations Desk (Quick fulfillment & analitik)
│   │   ├── vault/                    # Halaman Customer License Vault (Cek Lisensi)
│   │   ├── globals.css               # Sistem token CSS global & tema Dark Gold
│   │   ├── layout.tsx                # Root layout, font, dan navigasi global
│   │   └── page.tsx                  # Katalog etalase utama dan modal checkout
│   ├── components/
│   │   ├── MobileBottomNav.tsx       # Navigasi bawah ramah sentuhan seluler
│   │   └── Navbar.tsx                # Bar navigasi atas
│   └── lib/
│       ├── auth.ts                   # Helper autentikasi dan environment resolver
│       ├── dispatcher.ts             # Service dispatcher alert Telegram admin
│       └── supabase.ts               # Client Supabase PostgreSQL
├── supabase_schema.sql               # Skema DDL lengkap PostgreSQL Supabase
├── wrangler.jsonc                    # Konfigurasi Cloudflare Pages / Workers
├── open-next.config.ts               # Konfigurasi build OpenNext Cloudflare
├── package.json
└── README.md
```

---

## Panduan Instalasi & Menjalankan

### 1. Prasyarat
- Node.js versi 18.17 atau lebih baru.
- Akun Supabase (project PostgreSQL aktif).

### 2. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel konfigurasi:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni...

# Google OAuth (Opsional, untuk login Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# URL Aplikasi
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Pemasangan Dependensi
```bash
npm install
```

### 4. Menjalankan Server Lokal
```bash
npm run dev
```
Buka peramban di `http://localhost:3000`.

### 5. Membangun Bundle Produksi
```bash
# Standar Next.js
npm run build
npm start

# Atau untuk Cloudflare Pages
npm run build:cf
```

---

## Status Basis Data Supabase

### Apakah Ada yang Perlu Dieksekusi di Supabase?

1. **Untuk Project Supabase yang Sedang Terhubung Saat Ini**:
   - **TIDAK ADA**. Semua tabel (`categories`, `products`, `product_variants`, `orders`, `order_items`, `store_settings`, `dispatcher_logs`, `users`, `user_sessions`) beserta kolom pendukung (durasi lifetime, auto-expire 10 menit, dan baseline lisensi terkirim 50+) **sudah dibuat dan aktif di database**.
   
2. **Jika Membuat Project Supabase Baru dari Nol**:
   - Buka dashboard Supabase -> pilih menu **SQL Editor**.
   - Buka file [supabase_schema.sql](supabase_schema.sql) di root repositori.
   - Salin seluruh isi skrip dan jalankan (*Run*) di SQL Editor Supabase.
   - Skrip tersebut otomatis membangun seluruh tabel, relasi referensial, indeks pencarian cepat, serta data awal (*seed data*).

---

## Daftar Endpoint API

| Metode | Rute Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/store/products` | Mengambil katalog produk, varian, jam buka toko, dan counter lisensi terkirim |
| `POST` | `/api/v1/orders/checkout` | Membuat invoice pesanan baru (QRIS / VA) dengan batas kadaluwarsa 10 menit |
| `GET` | `/api/v1/orders/status/:token` | Mengambil status live pesanan pelanggan berdasarkan secure token |
| `POST` | `/api/v1/webhooks/payment` | Webhook konfirmasi pembayaran lunas dari payment gateway (Idempoten) |
| `GET` | `/api/v1/vault` | Mengambil riwayat seluruh pesanan dan lisensi berdasarkan email pelanggan |
| `POST` | `/api/v1/ops/orders/:id/fulfill` | Menyerahkan kredensial lisensi ke pesanan dan menandai status `FULFILLED` |
| `GET` | `/api/v1/ops/analytics/summary` | Analitik pendapatan harian/total, margin bersih, metrik SLA, dan status pesanan |
| `GET/PUT` | `/api/v1/ops/settings/store-status` | Saklar buka-tutup toko, nomor CS WhatsApp, dan konfigurasi baseline counter lisensi |

---

## Fitur Unggulan & Keamanan

- **Keamanan Secure Token**: Halaman pesanan diproteksi token acak 64 karakter (`secure_token`). Rincian aktivasi lisensi tidak dapat diakses tanpa token ini.
- **Auto-Expire 10 Menit**: Pesanan yang tidak diselesaikan dalam 10 menit otomatis berstatus `EXPIRED` untuk menjaga integritas antrean dan kuota inventaris.
- **Filter Brankas Lisensi Multi-Status**: Memungkinkan pelanggan memilah transaksi lunas/aktif dari tagihan tertunda tanpa kebingungan.
- **Simulator Admin Terproteksi**: Pengujian alur pembayaran dan penyerahan lisensi instan hanya dapat diakses oleh akun admin yang terautentikasi.
- **Dukungan Durasi Lifetime**: Produk dengan durasi atau garansi `0` otomatis diterjemahkan sebagai akses seumur hidup (*Unlimited/Lifetime*).

---

## Lisensi

Didistribusikan di bawah lisensi terbuka [MIT License](LICENSE).
