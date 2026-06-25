/**
 * telegramHandler.js
 * Nhận update từ Telegram, điều hướng xử lý
 */

const axios = require('axios');
const { processMessage } = require('./aiProcessor');
const { routeAction } = require('./actionRouter');
const { getDocById } = require('./firebaseService');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Xử lý update object từ Telegram webhook
 */
async function handleUpdate(update) {
  if (!update.message && !update.callback_query) return;

  const chatId = update.message?.chat.id || update.callback_query?.message.chat.id;

  // Xử lý callback query (khi user click button)
  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query, chatId);
  }

  if (!update.message) return;

  const message = update.message;
  const messageId = message.message_id;
  const userId = String(message.from.id);

  console.log(`[TELEGRAM] User ${userId} sent update`);

  await sendChatAction(chatId, 'typing');

  try {
    // Xử lý file/photo (TL - Tài liệu) - có hoặc không có caption
    if (message.document || message.photo) {
      return await handleFileMessage(message, chatId, userId, messageId);
    }

    // Xử lý text message (NK - Nhật ký, TL - Text, queries)
    if (message.text) {
      const text = message.text.trim();
      console.log(`[TELEGRAM] User ${userId}: "${text}"`);

      const normalizedText = text.toUpperCase();
      const aiResult = await processMessage(normalizedText);
      const result = await routeAction(aiResult, userId, chatId);

      // Xử lý response - có thể là string hoặc object {text, documents}
      if (typeof result === 'object' && result.text) {
        // Nếu có documents, gửi kèm inline button
        if (result.documents && result.documents.length > 0) {
          await sendMessageWithButtons(chatId, result.text, result.documents, { reply_to_message_id: messageId });
        } else {
          await sendMessage(chatId, result.text, { reply_to_message_id: messageId });
        }
      } else {
        // String response
        await sendMessage(chatId, result, { reply_to_message_id: messageId });
      }
    }
  } catch (err) {
    console.error('[TELEGRAM] Lỗi xử lý message:', err.message);
    await sendMessage(chatId, '❌ Có lỗi xảy ra, thử lại nhé!', { reply_to_message_id: message?.message_id });
  }
}

/**
 * Xử lý file/photo - có hoặc không có caption
 */
async function handleFileMessage(message, chatId, userId, messageId) {
  try {
    const caption = message.caption?.trim() || '';
    const documentService = require('./services/documentService');

    let fileId, fileName, fileType, fileSize;

    if (message.document) {
      fileId = message.document.file_id;
      fileName = message.document.file_name || 'Tài liệu';
      fileType = message.document.mime_type?.split('/').pop() || 'doc';
      fileSize = message.document.file_size;
      console.log(`[FILE] Document: ${fileName} (${fileType}, ${fileSize} bytes)`);
    } else if (message.photo) {
      const photoArray = message.photo;
      fileId = photoArray[photoArray.length - 1].file_id;
      fileName = 'Hình ảnh';
      fileType = 'jpg';
      fileSize = 0;
      console.log(`[FILE] Photo received`);
    }

    let description = '';
    if (caption.toUpperCase().startsWith('TL')) {
      description = caption.substring(2).trim();
      console.log(`[FILE] Caption with TL prefix: "${description}"`);
    } else if (caption) {
      description = caption;
      console.log(`[FILE] Caption without TL: "${description}"`);
    } else {
      description = fileName;
      console.log(`[FILE] No caption, using filename: "${description}"`);
    }

    const normalizedDesc = description.toUpperCase();
    const textToAnalyze = `TL ${normalizedDesc}`;
    console.log(`[FILE] Analyzing: "${textToAnalyze}"`);
    const aiResult = await processMessage(textToAnalyze);
    console.log(`[FILE] AI result:`, aiResult);

    const data = {
      ...aiResult.data,
      type: 'file',
      file_id: fileId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      source_message_id: messageId,
    };

    console.log(`[FILE] Creating document:`, data);
    const responseText = await documentService.createDocument(userId, data);
    console.log(`[FILE] Response:`, responseText);
    await sendMessage(chatId, responseText, { reply_to_message_id: messageId });
  } catch (err) {
    console.error('[FILE] Lỗi xử lý file:', err.message, err.stack);
    await sendMessage(chatId, `❌ Lỗi lưu tài liệu: ${err.message}`, { reply_to_message_id: messageId });
  }
}

/**
 * Xử lý callback query (khi user click button)
 */
async function handleCallbackQuery(query, chatId) {
  const { id, data, from, message } = query;
  const userId = String(from.id);

  console.log(`[CALLBACK] User ${userId} clicked: ${data}`);

  try {
    if (data.startsWith('view_')) {
      const docId = data.replace('view_', '');
      console.log(`[CALLBACK] Viewing document: ${docId}`);

      const doc = await getDocById(userId, 'documents', docId);

      if (!doc) {
        await answerCallbackQuery(id, '❌ Tài liệu không tồn tại');
        return;
      }

      const sourceMessageId = doc.source_message_id;
      if (!sourceMessageId) {
        await answerCallbackQuery(id, '⚠️ Không tìm thấy message gốc');
        return;
      }

      const responseText = `📌 Bạn đã upload file này lên:`;
      await sendMessage(chatId, responseText, { reply_to_message_id: sourceMessageId });
      await answerCallbackQuery(id, '✅ Đã nhảy đến file gốc!');
    }
  } catch (err) {
    console.error('[CALLBACK] Lỗi:', err.message);
    await answerCallbackQuery(id, '❌ Có lỗi xảy ra');
  }
}

/**
 * Gửi message kèm inline button
 */
async function sendMessageWithButtons(chatId, text, documents, options = {}) {
  try {
    const buttons = documents.map((doc) => [
      {
        text: `📍 ${(doc.description || doc.file_name || 'File').substring(0, 20)}`,
        callback_data: `view_${doc.id}`,
      },
    ]);

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
      ...options,
    });
  } catch (err) {
    console.error('[TELEGRAM] Lỗi gửi message với button:', err.message);
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

/**
 * Trả lời callback query
 */
async function answerCallbackQuery(id, text) {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: id,
      text: text,
      show_alert: false,
    });
  } catch (err) {
    console.error('[TELEGRAM] Lỗi trả lời callback:', err.message);
  }
}

module.exports = { handleUpdate, sendMessage };
