/**
 * reminderService.js
 * Quản lý nhắc việc - lưu Firestore và scheduler sẽ gửi đúng giờ
 */

const { addDoc, queryDocs } = require('../firebaseService');

/**
 * Parse thời gian từ data AI trả về
 * @returns {Date} - thời điểm nhắc
 */
function parseReminderTime(data) {
  const { time, date } = data;
  const now = new Date();

  // Xác định ngày
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date === 'tomorrow') {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (date && date !== 'today') {
    try {
      const parsed = new Date(date);
      if (!isNaN(parsed)) {
        targetDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    } catch {
      // dùng hôm nay
    }
  }

  // Xác định giờ phút
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours || 0, minutes || 0, 0, 0);
  } else {
    // Mặc định nhắc sau 1 tiếng
    targetDate = new Date(now.getTime() + 60 * 60 * 1000);
  }

  return targetDate;
}

/**
 * Tạo reminder mới
 */
async function createReminder(userId, chatId, data) {
  const { content } = data;

  if (!content) return '🔔 Bạn muốn nhắc việc gì?';

  const remindAt = parseReminderTime(data);

  // Kiểm tra thời gian hợp lệ (phải trong tương lai)
  if (remindAt <= new Date()) {
    return '⚠️ Thời gian nhắc phải là trong tương lai nhé!';
  }

  await addDoc(userId, 'reminders', {
    content,
    remindAt: remindAt.toISOString(),
    chatId: String(chatId),
    status: 'pending',
  });

  const timeStr = remindAt.toLocaleString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  return `🔔 *Đã đặt nhắc việc:*\n\n📌 ${content}\n⏰ ${timeStr}\n\n_Mình sẽ nhắc bạn đúng giờ!_`;
}

/**
 * Lấy reminders hôm nay (dùng trong overview)
 */
async function getRemindersToday(userId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  return await queryDocs(userId, 'reminders', [
    { field: 'remindAt', op: '>=', value: todayStart },
    { field: 'remindAt', op: '<', value: todayEnd },
  ], { field: 'remindAt', direction: 'asc' });
}

/**
 * Liệt kê tất cả reminders pending
 */
async function listReminders(userId) {
  const reminders = await queryDocs(userId, 'reminders', [
    { field: 'status', op: '==', value: 'pending' },
  ], { field: 'remindAt', direction: 'asc' }, 20);

  if (reminders.length === 0) {
    return '🔔 Không có nhắc việc nào đang chờ.';
  }

  let msg = `🔔 *NHẮC VIỆC (${reminders.length})*\n\n`;
  reminders.forEach((r, i) => {
    const timeStr = new Date(r.remindAt).toLocaleString('vi-VN', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    msg += `${i + 1}. ⏰ ${timeStr}\n   📌 ${r.content}\n\n`;
  });

  return msg;
}

module.exports = { createReminder, listReminders, getRemindersToday };
