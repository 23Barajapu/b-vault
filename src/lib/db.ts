import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'pro_license.sqlite');
const db = new Database(dbPath);

// Enable Write-Ahead Logging for concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone_number TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      thumbnail_url TEXT,
      platform_name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      fulfillment_model TEXT NOT NULL DEFAULT 'HYBRID_SUPPLIER',
      duration_days INTEGER NOT NULL DEFAULT 30,
      cost_price REAL NOT NULL DEFAULT 0,
      retail_price REAL NOT NULL,
      input_requirement_label TEXT,
      estimated_delivery_text TEXT DEFAULT '5 - 20 Menit',
      warranty_duration_days INTEGER NOT NULL DEFAULT 30,
      activation_guide TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      secure_token TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      target_account_input TEXT,
      total_amount REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
      payment_method TEXT NOT NULL,
      payment_reference TEXT,
      payment_channel_data TEXT,
      paid_at TEXT,
      expired_at TEXT NOT NULL,
      fulfilled_at TEXT,
      fulfillment_duration_seconds INTEGER,
      supplier_issue INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_secure_token ON orders (secure_token);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (payment_status);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES product_variants(id),
      unit_price REAL NOT NULL,
      activation_payload TEXT,
      admin_delivery_notes TEXT,
      warranty_expired_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dispatcher_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe migration for added columns
  try { db.exec('ALTER TABLE orders ADD COLUMN customer_name TEXT'); } catch {}
  try { db.exec('ALTER TABLE orders ADD COLUMN fulfillment_duration_seconds INTEGER'); } catch {}
  try { db.exec('ALTER TABLE order_items ADD COLUMN cost_price REAL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE order_items ADD COLUMN retail_price REAL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN is_two_factor_enabled INTEGER DEFAULT 0'); } catch {}

  // Seed default settings if missing
  const defaultSettings = [
    { key: 'store_status', value: 'ONLINE' },
    { key: 'operating_hours_notice', value: 'Pesanan di luar jam kerja (23:00 - 07:30 WIB) diproses mulai pukul 08:00 WIB' },
    { key: 'admin_whatsapp', value: '085183410190' },
    { key: 'telegram_bot_token', value: '' },
    { key: 'telegram_chat_id', value: '' }
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)`);
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }
}

// Auto init on import
initDatabase();

export default db;
