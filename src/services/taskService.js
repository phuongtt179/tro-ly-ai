/**
 * taskService.js
 * Quản lý công việc (to-do)
 */

const { addDoc, queryDocs, updateDoc } = require('../firebaseService');
const { createReminder } = require('./reminderService');

/**
 * Resolve date string sang ISO date string
 */
function resolveDate(dateStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!dateStr || dateStr === 'today') return today.toISOString();
  if (dateStr === 'tomorrow') {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return t.toISOString();
  }
  if (dateStr === 'next_week') {
    const t = new Date(today);
    t.setDate(t.getDate() + 7);
    return t.toISOString();
  }
  // Thử parse ISO date
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? today.toISOString() : parsed.toISOString();
}

/**
 * Tạo task mới
 */
async function createTask(userId, chatId, data) {
  const { content, priority = 'medium', date, time, tags = [] } = data;

  if (!content) return '📋 Bạn muốn tạo task gì?';

  const dueDate = resolveDate(date);

  await addDoc(userId, 'tasks', {
    content,
    status: 'pending',
    priority,
    dueDate,
    tags,
  });

  const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
  const dueDateStr = new Date(dueDate).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `✅ *Đã tạo task:*\n\n${priorityEmoji[priority] || '🟡'} ${content}\n📅 Hạn: ${dueDateStr}\n⚡ Ưu tiên: ${priority}`;

  // Nếu có giờ cụ thể → tự tạo reminder
  if (time && chatId) {
    await createReminder(userId, chatId, { content, time, date });
    msg += `\n🔔 Đã đặt nhắc lúc ${time}`;
  }

  return msg;
}

/**
 * Đánh dấu hoàn thành task (tìm theo content gần giống)
 */
async function completeTask(userId, data) {
  const { content } = data;
  if (!content) return '❓ Task nào bạn muốn đánh dấu xong?';

  // Lấy tất cả task pending
  const tasks = await queryDocs(userId, 'tasks', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  // Tìm task có content gần giống nhất (lowercase, includes)
  const keyword = content.toLowerCase();
  const match = tasks.find((t) => t.content.toLowerCase().includes(keyword));

  if (!match) {
    // Fallback: tìm trong reminders
    const reminders = await queryDocs(userId, 'reminders', [
      { field: 'status', op: '==', value: 'pending' },
    ]);
    const reminderMatch = reminders.find((r) => r.content.toLowerCase().includes(keyword));

    if (!reminderMatch) {
      return `❌ Không tìm thấy "${content}" trong task hay nhắc việc.`;
    }

    await updateDoc(userId, 'reminders', reminderMatch.id, {
      status: 'done',
      completedAt: new Date().toISOString(),
    });

    return `🎉 *Hoàn thành nhắc việc:* ${reminderMatch.content}\n\nTuyệt vời! Cứ tiếp tục nhé! 💪`;
  }

  await updateDoc(userId, 'tasks', match.id, {
    status: 'done',
    completedAt: new Date().toISOString(),
  });

  return `🎉 *Hoàn thành:* ${match.content}\n\nTuyệt vời! Cứ tiếp tục nhé! 💪`;
}

/**
 * Cập nhật task
 */
async function updateTask(userId, data) {
  const { content, priority, date } = data;
  if (!content) return '❓ Task nào bạn muốn cập nhật?';

  const tasks = await queryDocs(userId, 'tasks', [
    { field: 'status', op: '==', value: 'pending' },
  ]);

  const keyword = content.toLowerCase();
  const match = tasks.find((t) => t.content.toLowerCase().includes(keyword));

  if (!match) return `❌ Không tìm thấy task "${content}"`;

  const updateData = {};
  if (priority) updateData.priority = priority;
  if (date) updateData.dueDate = resolveDate(date);

  await updateDoc(userId, 'tasks', match.id, updateData);
  return `✏️ Đã cập nhật task: *${match.content}*`;
}

/**
 * Lấy tasks theo ngày bất kỳ (dùng cho tomorrow_overview)
 */
async function getTasksByDate(userId, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
  return await queryDocs(userId, 'tasks', [
    { field: 'dueDate', op: '>=', value: start },
    { field: 'dueDate', op: '<', value: end },
  ], { field: 'createdAt', direction: 'asc' });
}

/**
 * Lấy tasks hôm nay (dùng cho actionRouter và overview)
 */
async function getTasksToday(userId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  return await queryDocs(userId, 'tasks', [
    { field: 'dueDate', op: '>=', value: todayStart },
    { field: 'dueDate', op: '<', value: todayEnd },
  ], { field: 'createdAt', direction: 'asc' });
}

/**
 * Liệt kê tasks hôm nay (trả message)
 */
async function listTasksToday(userId) {
  const tasks = await getTasksToday(userId);

  if (tasks.length === 0) {
    return '✅ Hôm nay không có task nào. Nghỉ ngơi thôi! 🎉';
  }

  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  let msg = `📋 *TASK HÔM NAY (${tasks.length})*\n\n`;

  if (pending.length > 0) {
    msg += `⏳ *Chưa xong (${pending.length}):*\n`;
    pending.forEach((t, i) => {
      const p = { high: '🔴', medium: '🟡', low: '🟢' };
      msg += `${i + 1}. ${p[t.priority] || '🟡'} ${t.content}\n`;
    });
  }

  if (done.length > 0) {
    msg += `\n✅ *Đã xong (${done.length}):*\n`;
    done.forEach((t, i) => {
      msg += `${i + 1}. ~~${t.content}~~\n`;
    });
  }

  return msg;
}

/**
 * Lấy tasks tuần này
 */
async function getTasksWeek(userId) {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  return await queryDocs(userId, 'tasks', [
    { field: 'dueDate', op: '>=', value: weekStart },
    { field: 'dueDate', op: '<', value: weekEnd },
  ], { field: 'dueDate', direction: 'asc' }, 100);
}

/**
 * Liệt kê tasks tuần này (trả message)
 */
async function listTasksWeek(userId) {
  const tasks = await getTasksWeek(userId);

  if (tasks.length === 0) {
    return '✅ Tuần này không có task nào được lên lịch.';
  }

  let msg = `📋 *TASK TUẦN NÀY (${tasks.length})*\n\n`;
  tasks.forEach((t) => {
    const status = t.status === 'done' ? '✅' : '⬜';
    const date = new Date(t.dueDate).toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    msg += `${status} ${date}: ${t.content}\n`;
  });

  return msg;
}

module.exports = {
  createTask,
  completeTask,
  updateTask,
  listTasksToday,
  listTasksWeek,
  getTasksToday,
  getTasksWeek,
  getTasksByDate,
};
