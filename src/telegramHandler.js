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
  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const userId = String(message.from.id);

  console.log(`[TELEGRAM] User ${userId} sent update`);

  // Gửi typing indicator
  await sendChatAction(chatId, 'typing');

  try {
    // Xử lý file/photo (TL - Tài liệu) - có hoặc không có caption
    if (message.document || message.photo) {
      return await handleFileMessage(message, chatId, userId);
    }

    // Xử lý text message (NK - Nhật ký, TL - Text, queries)
    if (message.text) {
      const text = message.text.trim();
      console.log(`[TELEGRAM] User ${userId}: "${text}"`);

      const aiResult = await processMessage(text);
      const responseText = await routeAction(aiResult, userId, chatId);
      await sendMessage(chatId, responseText);
    }
  } catch (err) {
    console.error('[TELEGRAM] Lỗi xử lý message:', err.message);
    await sendMessage(chatId, '❌ Có lỗi xảy ra, thử lại nhé!');
  }
}

/**
 * Xử lý file/photo - có hoặc không có caption
 */
async function handleFileMessage(message, chatId, userId) {
  const caption = message.caption?.trim() || '';

  let fileId, fileName, fileType, fileSize;

  // Lấy file info từ document hoặc photo
  if (message.document) {
    fileId = message.document.file_id;
    fileName = message.document.file_name || 'Tài liệu';
    fileType = message.document.mime_type?.split('/').pop() || 'doc';
    fileSize = message.document.file_size;
  } else if (message.photo) {
    const photoArray = message.photo;
    fileId = photoArray[photoArray.length - 1].file_id; // Hình ảnh chất lượng cao nhất
    fileName = 'Hình ảnh';
    fileType = 'jpg';
    fileSize = 0;
  }

  // Nếu có caption bắt đầu bằng "TL", lấy phần mô tả
  // Nếu không có caption, dùng file name làm mô tả
  let description = '';
  if (caption.toUpperCase().startsWith('TL')) {
    description = caption.substring(2).trim();
  } else if (caption) {
    // Nếu có caption nhưng không bắt đầu bằng TL, dùng caption làm mô tả
    description = caption;
  } else {
    // Không có caption, dùng file name
    description = fileName;
  }

  // Gửi cho Gemini phân loại dựa trên mô tả
  const textToAnalyze = `TL ${description}`;
  const aiResult = await processMessage(textToAnalyze);

  // Thêm file info vào data
  const data = {
    ...aiResult.data,
    type: 'file',
    file_id: fileId,
    file_name: fileName,
    file_type: fileType,
    file_size: fileSize,
  };

  // Gọi documentService.createDocument
  const documentService = require('./services/documentService');
  const responseText = await documentService.createDocument(userId, data);
  await sendMessage(chatId, responseText);
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
