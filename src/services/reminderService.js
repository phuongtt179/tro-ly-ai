/**
 * reminderService.js
 * Quản lý nhắc việc - lưu Firestore và scheduler sẽ gửi đúng giờ
 */

const { addDoc, queryDocs, updateDoc, deleteDoc } = require('../firebaseService');

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
    reminderSent: false,
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

/**
 * Lấy reminders theo ngày bất kỳ (dùng cho tomorrow_overview)
 */
async function getRemindersByDate(userId, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
  return await queryDocs(userId, 'reminders', [
    { field: 'remindAt', op: '>=', value: start },
    { field: 'remindAt', op: '<', value: end },
  ], { field: 'remindAt', direction: 'asc' });
}

/**
 * Sửa nhắc việc (thời gian hoặc nội dung)
 */
async function updateReminder(userId, data) {
  const { content, new_content, time, date } = data;
  if (!content) return '❓ Nhắc việc nào bạn muốn sửa?';

  const reminders = await queryDocs(userId, 'reminders', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = reminders.find((r) => r.content.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy nhắc việc "${content}".`;

  const updateData = {};
  if (new_content) updateData.content = new_content;

  if (time || date) {
    const newRemindAt = parseReminderTime({
      time: time || match.time,
      date: date || match.remindAt?.split('T')[0],
    });
    if (newRemindAt <= new Date()) return '⚠️ Thời gian nhắc phải là trong tương lai nhé!';
    updateData.remindAt = newRemindAt.toISOString();
    updateData.reminderSent = false;
  }

  await updateDoc(userId, 'reminders', match.id, updateData);

  const updatedContent = new_content || match.content;
  const timeStr = updateData.remindAt
    ? new Date(updateData.remindAt).toLocaleString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
      })
    : null;

  let msg = `✏️ *Đã sửa nhắc việc:*\n\n📌 ${updatedContent}`;
  if (timeStr) msg += `\n⏰ ${timeStr}`;
  return msg;
}

/**
 * Xóa nhắc việc
 */
async function deleteReminder(userId, data) {
  const { content } = data;
  if (!content) return '❓ Nhắc việc nào bạn muốn xóa?';

  const reminders = await queryDocs(userId, 'reminders', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = reminders.find((r) => r.content.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy nhắc việc "${content}".`;

  await deleteDoc(userId, 'reminders', match.id);
  return `🗑 Đã xóa nhắc việc: *${match.content}*`;
}

module.exports = { createReminder, listReminders, getRemindersToday, getRemindersByDate, updateReminder, deleteReminder };
