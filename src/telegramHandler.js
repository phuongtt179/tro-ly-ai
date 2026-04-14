/**
 * telegramHandler.js
 * Nhận update từ Telegram, điều hướng xử lý
 */

const axios = require('axios');
const { processMessage } = require('./aiProcessor');
const { routeAction } = require('./actionRouter');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Xử lý update object từ Telegram webhook
 */
async function handleUpdate(update) {
  // Chỉ xử lý message text
  if (!update.message || !update.message.text) return;

  const message = update.message;
  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text.trim();

  console.log(`[TELEGRAM] User ${userId}: "${text}"`);

  // Gửi typing indicator
  await sendChatAction(chatId, 'typing');

  try {
    // Bước 1: AI phân tích intent
    const aiResult = await processMessage(text);

    // Bước 2: Route đến service tương ứng
    const responseText = await routeAction(aiResult, userId, chatId);

    // Bước 3: Gửi phản hồi về Telegram
    await sendMessage(chatId, responseText);
  } catch (err) {
    console.error('[TELEGRAM] Lỗi xử lý message:', err.message);
    await sendMessage(chatId, '❌ Có lỗi xảy ra, thử lại nhé!');
  }
}

/**
 * Gửi tin nhắn đến Telegram chat
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options,
    });
  } catch (err) {
    console.error('[TELEGRAM] Lỗi gửi message:', err.message);
  }
}

/**
 * Gửi typing indicator
 */
async function sendChatAction(chatId, action = 'typing') {
  try {
    await axios.post(`${TELEGRAM_API}/sendChatAction`, {
      chat_id: chatId,
      action: action,
    });
  } catch (err) {
    // Bỏ qua lỗi typing indicator
  }
}

module.exports = { handleUpdate, sendMessage };
