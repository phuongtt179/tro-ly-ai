/**
 * scheduleService.js
 * Quản lý lịch công tác - thêm/sửa/xóa/xem + tự tạo reminder nếu có giờ
 */

const { addDoc, queryDocs, updateDoc, deleteDoc } = require('../firebaseService');

// Map thứ tiếng Việt → số (0=CN, 1=T2...6=T7)
const DAY_MAP = {
  'chủ nhật': 0, 'cn': 0,
  'thứ 2': 1, 'thứ hai': 1, 't2': 1,
  'thứ 3': 2, 'thứ ba': 2, 't3': 2,
  'thứ 4': 3, 'thứ tư': 3, 't4': 3,
  'thứ 5': 4, 'thứ năm': 4, 't5': 4,
  'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
  'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
};

/**
 * Tính ngày cụ thể từ "thứ X tuần tới/này"
 */
function resolveDayOfWeek(dayStr, weekOffset = 0) {
  const key = dayStr.toLowerCase().trim();
  const targetDow = DAY_MAP[key];
  if (targetDow === undefined) return null;

  const now = new Date();
  // Đầu tuần hiện tại (thứ 2)
  const currentDow = now.getDay(); // 0=CN
  const diffToMonday = (currentDow === 0 ? -6 : 1 - currentDow);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + weekOffset * 7);

  // targetDow: 0=CN→6, 1=T2→0, ...6=T7→5
  const offsetFromMonday = targetDow === 0 ? 6 : targetDow - 1;
  const result = new Date(monday);
  result.setDate(monday.getDate() + offsetFromMonday);
  return result;
}

/**
 * Tạo nhiều lịch công tác từ mảng items
 * items: [{ day, content, time, note }]
 */
async function createScheduleBatch(userId, chatId, items, weekOffset = 1) {
  if (!items || items.length === 0) return '📅 Không có lịch nào để thêm.';

  const created = [];
  const failed = [];

  for (const item of items) {
    const date = resolveDayOfWeek(item.day, weekOffset);
    if (!date) {
      failed.push(item.content || item.day);
      continue;
    }

    // Set giờ nếu có
    let remindAt = null;
    if (item.time) {
      const [h, m] = item.time.split(':').map(Number);
      const remind = new Date(date);
      remind.setHours(h || 7, m || 0, 0, 0);
      // Chỉ tạo reminder nếu trong tương lai
      if (remind > new Date()) {
        remindAt = remind.toISOString();
      }
    }

    const docId = await addDoc(userId, 'schedule', {
      content: item.content,
      day: item.day,
      date: date.toISOString(),
      time: item.time || null,
      note: item.note || null,
      remindAt,
      chatId: String(chatId),
      status: 'pending',
      reminderSent: false,
    });

    created.push({ ...item, date, docId });
  }

  // Format response
  let msg = `📅 *Đã lưu lịch công tác (${created.length} việc):*\n\n`;

  // Sắp xếp theo ngày
  created.sort((a, b) => a.date - b.date);

  created.forEach((item) => {
    const dateStr = item.date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const timeStr = item.time ? ` 🕐 ${item.time}` : '';
    const bell = item.time ? ' 🔔' : '';
    msg += `• *${dateStr}*${timeStr}: ${item.content}${bell}\n`;
  });

  if (failed.length > 0) {
    msg += `\n⚠️ Không nhận được ngày cho: ${failed.join(', ')}`;
  }

  if (created.some((i) => i.time)) {
    msg += '\n\n_🔔 = sẽ được nhắc đúng giờ_';
  }

  return msg;
}

/**
 * Thêm 1 lịch công tác đơn lẻ
 */
async function addScheduleItem(userId, chatId, data) {
  const { content, day, date, time, note } = data;
  if (!content) return '📅 Nội dung công việc là gì?';

  // Xác định ngày
  let targetDate;
  if (day) {
    // Thử tuần này trước, nếu đã qua thì tuần tới
    targetDate = resolveDayOfWeek(day, 0);
    if (targetDate && targetDate < new Date()) {
      targetDate = resolveDayOfWeek(day, 1);
    }
  } else if (date) {
    targetDate = new Date(date);
  } else {
    targetDate = new Date();
  }

  if (!targetDate || isNaN(targetDate)) return '⚠️ Không xác định được ngày, thử lại nhé!';

  let remindAt = null;
  if (time) {
    const [h, m] = time.split(':').map(Number);
    const remind = new Date(targetDate);
    remind.setHours(h || 7, m || 0, 0, 0);
    if (remind > new Date()) remindAt = remind.toISOString();
  }

  const docId = await addDoc(userId, 'schedule', {
    content,
    day: day || null,
    date: targetDate.toISOString(),
    time: time || null,
    note: note || null,
    remindAt,
    chatId: String(chatId),
    status: 'pending',
    reminderSent: false,
  });

  const dateStr = targetDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const timeStr = time ? ` lúc ${time}` : '';
  const bell = remindAt ? '\n🔔 Sẽ nhắc trước giờ làm việc.' : '';

  return `📅 *Đã thêm lịch:*\n\n📌 ${content}\n📆 ${dateStr}${timeStr}${bell}`;
}

/**
 * Xem lịch công tác theo ngày hoặc tuần
 */
async function listSchedule(userId, data = {}) {
  const { date, period } = data;

  let startDate, endDate, title;

  if (period === 'week' || period === 'next_week') {
    const offset = period === 'next_week' ? 1 : 0;
    const now = new Date();
    const currentDow = now.getDay();
    const diffToMonday = currentDow === 0 ? -6 : 1 - currentDow;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + offset * 7);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
    title = offset === 1 ? 'LỊCH TUẦN TỚI' : 'LỊCH TUẦN NÀY';
  } else if (date === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
    title = 'LỊCH NGÀY MAI';
  } else {
    // Mặc định: hôm nay
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
    title = 'LỊCH HÔM NAY';
  }

  const items = await queryDocs(userId, 'schedule', [
    { field: 'date', op: '>=', value: startDate.toISOString() },
    { field: 'date', op: '<', value: endDate.toISOString() },
  ], { field: 'date', direction: 'asc' }, 50);

  if (items.length === 0) return `📅 Không có lịch công tác nào trong khoảng này.`;

  let msg = `📅 *${title} (${items.length} việc)*\n\n`;

  items.forEach((item, i) => {
    const dateStr = new Date(item.date).toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const timeStr = item.time ? ` 🕐${item.time}` : '';
    const status = item.status === 'done' ? '✅' : '📌';
    const noteStr = item.note ? `\n   _↳ ${item.note}_` : '';
    msg += `${status} *${dateStr}*${timeStr}: ${item.content}${noteStr}\n`;
  });

  return msg;
}

/**
 * Lấy lịch công tác theo ngày (dùng trong overview)
 */
async function getScheduleByDate(userId, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return await queryDocs(userId, 'schedule', [
    { field: 'date', op: '>=', value: start.toISOString() },
    { field: 'date', op: '<', value: end.toISOString() },
  ], { field: 'date', direction: 'asc' }, 20);
}

/**
 * Sửa lịch công tác (tìm theo content)
 */
async function updateScheduleItem(userId, data) {
  const { content, new_content, time, date, note } = data;
  if (!content) return '❓ Muốn sửa công việc nào?';

  const items = await queryDocs(userId, 'schedule', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = items.find((i) => i.content.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy "${content}" trong lịch.`;

  const updateData = {};
  if (new_content) updateData.content = new_content;
  if (note) updateData.note = note;

  if (time) {
    updateData.time = time;
    const baseDate = new Date(match.date);
    const [h, m] = time.split(':').map(Number);
    baseDate.setHours(h, m, 0, 0);
    if (baseDate > new Date()) {
      updateData.remindAt = baseDate.toISOString();
      updateData.reminderSent = false;
    }
  }

  if (date) {
    const newDate = new Date(date);
    if (!isNaN(newDate)) updateData.date = newDate.toISOString();
  }

  await updateDoc(userId, 'schedule', match.id, updateData);
  return `✏️ Đã cập nhật: *${match.content}*`;
}

/**
 * Xóa lịch công tác (tìm theo content)
 */
async function deleteScheduleItem(userId, data) {
  const { content } = data;
  if (!content) return '❓ Muốn xóa công việc nào?';

  const items = await queryDocs(userId, 'schedule', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = items.find((i) => i.content.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy "${content}" trong lịch.`;

  await deleteDoc(userId, 'schedule', match.id);
  return `🗑 Đã xóa khỏi lịch: *${match.content}*`;
}

/**
 * Đánh dấu hoàn thành lịch công tác
 */
async function completeScheduleItem(userId, data) {
  const { content } = data;
  if (!content) return '❓ Công việc nào đã xong?';

  const items = await queryDocs(userId, 'schedule', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = items.find((i) => i.content.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy "${content}" trong lịch.`;

  await updateDoc(userId, 'schedule', match.id, {
    status: 'done',
    completedAt: new Date().toISOString(),
  });

  return `✅ Hoàn thành: *${match.content}*`;
}

module.exports = {
  createScheduleBatch,
  addScheduleItem,
  listSchedule,
  getScheduleByDate,
  updateScheduleItem,
  deleteScheduleItem,
  completeScheduleItem,
};
