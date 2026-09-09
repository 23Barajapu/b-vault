import db from './db';

interface TelegramAlertPayload {
  orderNumber: string;
  productName: string;
  variantName: string;
  customerEmail: string;
  customerPhone: string;
  targetAccount: string | null;
  totalAmount: number;
  paidAt: string;
  fulfillUrl: string;
}

export async function dispatchTelegramAdminAlert(payload: TelegramAlertPayload, orderId: number) {
  // Get Telegram credentials from store_settings or env
  const tokenRow = db.prepare(`SELECT value FROM store_settings WHERE key = 'telegram_bot_token'`).get() as { value: string } | undefined;
  const chatRow = db.prepare(`SELECT value FROM store_settings WHERE key = 'telegram_chat_id'`).get() as { value: string } | undefined;

  const botToken = process.env.TELEGRAM_BOT_TOKEN || tokenRow?.value || '';
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || chatRow?.value || '';

  const message = [
    `🚨 *ORDER BARU MASUK (PAID)*`,
    `--------------------------------`,
    `📦 *Invoice:* \`${payload.orderNumber}\``,
    `🛍️ *Produk:* ${payload.productName}`,
    `⚡ *Varian:* ${payload.variantName}`,
    `💰 *Total:* Rp ${payload.totalAmount.toLocaleString('id-ID')}`,
    `👤 *Email Pembeli:* \`${payload.customerEmail}\``,
    `📱 *WhatsApp:* \`${payload.customerPhone}\``,
    payload.targetAccount ? `🎯 *Target Akun:* \`${payload.targetAccount}\`` : `🎯 *Target Akun:* (Akun Baru / Tidak Diperlukan)`,
    `⏰ *Waktu Bayar:* ${payload.paidAt}`,
    `⏳ *Estimasi SLA:* 5 - 20 Menit`,
    `--------------------------------`,
    `🔗 *Fulfill Desk:* [Klik untuk Isi Lisensi](${payload.fulfillUrl})`
  ].join('\n');

  let status = 'SIMULATED';
  let errorMessage: string | null = null;

  if (botToken && chatId) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ Buka Konsol Pemenuhan', url: payload.fulfillUrl }]
            ]
          }
        })
      });
      const data = await tgRes.json();
      if (data.ok) {
        status = 'SENT';
      } else {
        status = 'FAILED';
        errorMessage = data.description || 'Telegram API returned error';
      }
    } catch (err: any) {
      status = 'FAILED';
      errorMessage = err.message || 'Network error sending to Telegram';
    }
  }

  // Record audit log
  try {
    db.prepare(`
      INSERT INTO dispatcher_logs (order_id, channel, status, payload, error_message)
      VALUES (?, 'TELEGRAM_ADMIN', ?, ?, ?)
    `).run(orderId, status, JSON.stringify({ message, botTokenSet: Boolean(botToken), chatIdSet: Boolean(chatId) }), errorMessage);
  } catch (logErr) {
    console.error('Failed to write dispatcher log', logErr);
  }

  return { status, errorMessage };
}
