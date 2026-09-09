# B-Vault

Platform e-commerce reseller lisensi pro dan akun digital berbasis arsitektur on-demand hybrid. Dirancang untuk mengatasi kendala operasional reseller dengan memadukan pembayaran otomatis, dispatcher notifikasi admin, konsol pemenuhan mobile-friendly, dan pelacakan status pesanan pelanggan secara real-time.

---

## Gambaran Arsitektur

Platform ini bekerja dengan model hybrid:
1. **Checkout Cepat**: Pembeli memilih produk (Canva, ChatGPT, Notion, JetBrains) dan mengisi akun target tanpa registrasi rumit.
2. **Otomasi Pembayaran**: Sistem menyediakan QRIS Dinamis dan Virtual Account Multi-Bank dengan hitung mundur pembayaran 15 menit.
3. **Internal Dispatcher**: Pembayaran lunas memicu alert instan ke bot admin (Telegram) dengan link akses langsung ke konsol pemenuhan.
4. **Quick Fulfillment**: Admin menempelkan tautan aktivasi atau kredensial langsung dari ponsel, sistem memperbarui layar pembeli secara real-time.
5. **Customer Vault**: Pembeli dapat melihat kembali seluruh riwayat lisensi yang pernah dibeli beserta sisa masa garansi.

---

## Teknologi yang Digunakan

- **Frontend & API**: Next.js 14 (App Router) dan TypeScript.
- **Basis Data**: SQLite (`better-sqlite3`) dengan mode WAL (*Write-Ahead Logging*).
- **Desain & Antarmuka**: Vanilla CSS berstandar aksesibilitas WCAG AA (rasio kontras tinggi dan target ketuk minimal 44px).
- **Notifikasi**: Integrasi Webhook Payment Gateway dan Telegram Bot API.

---

## Struktur Direktori

```
jualan/
├── src/
│   ├── app/
│   │   ├── admin/             # Konsol pemenuhan pesanan mobile-friendly
│   │   ├── api/v1/            # Endpoint REST API (katalog, order, webhook, vault)
│   │   ├── orders/[orderNumber]/ # Halaman live stepper status pesanan
│   │   ├── vault/             # Customer License Vault
│   │   ├── globals.css        # Sistem desain Vanilla CSS
│   │   ├── layout.tsx         # Shell aplikasi dan navigasi utama
│   │   └── page.tsx           # Katalog produk dan modal checkout
│   └── lib/
│       ├── db.ts              # Inisialisasi basis data SQLite dan relasi tabel
│       └── dispatcher.ts      # Layanan dispatcher notifikasi Telegram admin
├── .gitignore                 # Filter proteksi file sensitif dan arsip database
├── LICENSE                    # Lisensi lisensi terbuka MIT
├── next.config.js             # Konfigurasi Next.js
├── package.json               # Dependensi proyek dan skrip npm
├── README.md                  # Dokumentasi proyek
└── tsconfig.json              # Konfigurasi TypeScript
```

---

## Panduan Instalasi & Menjalankan

### 1. Prasyarat
- Node.js versi 18 atau lebih baru.
- npm atau pnpm.

### 2. Pemasangan Dependensi
```bash
npm install
```

### 3. Menjalankan Server Pengembangan
```bash
npm run dev
```
Aplikasi dapat diakses di `http://localhost:3000`.

### 4. Membangun Versi Produksi
```bash
npm run build
npm start
```

---

## Daftar Endpoint API

| Metode | Rute Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Mengambil katalog produk aktif dan status jam buka toko |
| `POST` | `/api/v1/orders/checkout` | Membuat pesanan baru dan menerbitkan tagihan QRIS/VA |
| `GET` | `/api/v1/orders/status/:token` | Polling data status pesanan dan penyerahan lisensi |
| `POST` | `/api/v1/webhooks/payment` | Webhook pembayaran lunas dengan kunci idempoten |
| `GET` | `/api/v1/admin/orders/pending-fulfillment` | Daftar antrean order butuh tautan aktivasi |
| `POST` | `/api/v1/admin/orders/:id/fulfill` | Input kredensial aktivasi dan selesaikan pesanan |
| `POST` | `/api/v1/admin/orders/:id/supplier-issue` | Tandai kendala antrean supplier atau proses refund |
| `GET/POST`| `/api/v1/admin/settings/store-status` | Pengaturan jam operasional dan kredensial Telegram |
| `GET` | `/api/v1/vault` | Pencarian arsip lisensi pelanggan berdasarkan email |

---

## Keamanan & Proteksi Data

- **Token Hash Terproteksi**: Halaman rincian pesanan dilindungi token 64 karakter acak (`secure_token`). Pihak luar tidak dapat mengintip lisensi hanya dengan menebak nomor invoice.
- **Proteksi Git**: File spesifikasi internal (`PRD*.md`), basis data transaksi (`*.sqlite`), dan berkas variabel lingkungan (`.env*`) dikecualikan dari repositori melalui `.gitignore`.
- **Validasi Input Ketat**: Validasi format email RFC 5322, pemblokiran domain email sementara, dan validasi format nomor ponsel Indonesia.

---

## Lisensi

Proyek ini didistribusikan di bawah lisensi terbuka [MIT License](LICENSE).
