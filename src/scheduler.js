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
 * Kiểm tra reminders + lịch công tác đến giờ và gửi thông báo
 */
async function checkAndSendReminders() {
  const now = new Date();
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

  await Promise.all([
    checkCollection('reminders', now, oneMinuteLater, '🔔 *NHẮC VIỆC*'),
    checkCollection('schedule', now, oneMinuteLater, '📅 *NHẮC LỊCH CÔNG TÁC*'),
  ]);
}

/**
 * Kiểm tra 1 collection và gửi thông báo
 */
async function checkCollection(collectionName, now, oneMinuteLater, label) {
  try {
    const snapshot = await db
      .collectionGroup(collectionName)
      .where('reminderSent', '==', false)
      .where('remindAt', '>=', now.toISOString())
      .where('remindAt', '<=', oneMinuteLater.toISOString())
      .get();

    if (snapshot.empty) return;

    console.log(`[SCHEDULER] ${collectionName}: ${snapshot.size} item(s) cần gửi`);

    for (const doc of snapshot.docs) {
      const item = doc.data();
      try {
        const msg = `${label}\n\n📌 ${item.content}\n\n_Đừng quên nhé!_`;
        await sendMessage(item.chatId, msg);
        await doc.ref.update({ reminderSent: true, sentAt: new Date().toISOString() });
        console.log(`[SCHEDULER] Đã gửi (${collectionName}): ${item.content}`);
      } catch (err) {
        console.error(`[SCHEDULER] Lỗi gửi ${doc.id}:`, err.message);
      }
    }
  } catch (err) {
    if (err.code === 9) {
      console.warn(`[SCHEDULER] Cần tạo Firestore index cho ${collectionName} (reminderSent + remindAt)`);
    } else {
      console.error(`[SCHEDULER] Lỗi kiểm tra ${collectionName}:`, err.message);
    }
  }
}

module.exports = { initScheduler };
