/**
 * server.js - Entry point
 * Express server nhận webhook từ Telegram
 */

require('dotenv').config();
const express = require('express');
const { handleUpdate } = require('./src/telegramHandler');
const { initScheduler } = require('./src/scheduler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bot AI cá nhân đang chạy' });
});

// Webhook endpoint - Telegram gửi update vào đây
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  // Trả về 200 ngay để Telegram không timeout
  res.sendStatus(200);

  try {
    const update = req.body;
    await handleUpdate(update);
  } catch (err) {
    console.error('[SERVER] Lỗi xử lý update:', err.message);
  }
});

// Khởi động server
app.listen(PORT, async () => {
  console.log(`[SERVER] Đang chạy trên port ${PORT}`);

  // Đăng ký webhook với Telegram
  if (WEBHOOK_URL) {
    await registerWebhook();
  } else {
    console.warn('[SERVER] WEBHOOK_URL chưa set - bỏ qua đăng ký webhook');
  }

  // Khởi động scheduler kiểm tra reminder
  initScheduler();
  console.log('[SERVER] Scheduler đã khởi động');
});

// Đăng ký webhook URL với Telegram API
async function registerWebhook() {
  const fetch = require('node-fetch');
  const webhookUrl = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );
    const data = await res.json();
    if (data.ok) {
      console.log(`[SERVER] Webhook đã đăng ký: ${webhookUrl}`);
    } else {
      console.error('[SERVER] Đăng ký webhook thất bại:', data.description);
    }
  } catch (err) {
    console.error('[SERVER] Lỗi đăng ký webhook:', err.message);
  }
}
