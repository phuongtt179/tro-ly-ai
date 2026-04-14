/**
 * scheduler.js
 * Cron job kiểm tra reminder mỗi phút và gửi thông báo Telegram
 */

const cron = require('node-cron');
const { queryGlobal, updateDoc, db } = require('./firebaseService');
const { sendMessage } = require('./telegramHandler');

/**
 * Khởi động scheduler - chạy mỗi phút
 */
function initScheduler() {
  // Chạy mỗi phút: '* * * * *'
  cron.schedule('* * * * *', async () => {
    await checkAndSendReminders();
  }, {
    timezone: 'Asia/Ho_Chi_Minh',
  });

  console.log('[SCHEDULER] Đang kiểm tra reminders mỗi phút');
}

/**
 * Kiểm tra reminders đến giờ và gửi thông báo
 */
async function checkAndSendReminders() {
  const now = new Date();
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

  try {
    // Query tất cả reminders pending trong khoảng now đến 1 phút tới
    // Dùng collectionGroup query để lấy từ tất cả users
    const snapshot = await db
      .collectionGroup('reminders')
      .where('status', '==', 'pending')
      .where('remindAt', '>=', now.toISOString())
      .where('remindAt', '<=', oneMinuteLater.toISOString())
      .get();

    if (snapshot.empty) return;

    console.log(`[SCHEDULER] Tìm thấy ${snapshot.size} reminder(s) cần gửi`);

    for (const doc of snapshot.docs) {
      const reminder = { id: doc.id, ref: doc.ref, ...doc.data() };

      try {
        // Gửi thông báo Telegram
        const msg = `🔔 *NHẮC VIỆC*\n\n📌 ${reminder.content}\n\n_Đừng quên nhé!_`;
        await sendMessage(reminder.chatId, msg);

        // Đánh dấu đã gửi
        await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });

        console.log(`[SCHEDULER] Đã gửi reminder: ${reminder.content}`);
      } catch (err) {
        console.error(`[SCHEDULER] Lỗi gửi reminder ${doc.id}:`, err.message);
      }
    }
  } catch (err) {
    // Lỗi query (thường do chưa có composite index) - bỏ qua
    if (err.code === 9) {
      console.warn('[SCHEDULER] Cần tạo Firestore index cho reminders - xem README');
    } else {
      console.error('[SCHEDULER] Lỗi kiểm tra reminders:', err.message);
    }
  }
}

module.exports = { initScheduler };
