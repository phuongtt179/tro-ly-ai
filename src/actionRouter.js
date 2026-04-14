/**
 * actionRouter.js
 * Nhận intent + data từ AI, điều hướng đến service tương ứng
 */

const journalService = require('./services/journalService');
const taskService = require('./services/taskService');
const reminderService = require('./services/reminderService');
const planService = require('./services/planService');

/**
 * Route action dựa vào intent từ AI
 * @param {Object} aiResult - { intent, data }
 * @param {string} userId - Telegram user ID
 * @param {string} chatId - Telegram chat ID
 * @returns {string} - Message trả về cho người dùng
 */
async function routeAction(aiResult, userId, chatId) {
  const { intent, data } = aiResult;

  console.log(`[ROUTER] Intent: ${intent}`, data);

  switch (intent) {
    // === NHẬT KÝ ===
    case 'create_journal':
      return await journalService.createJournal(userId, data);

    case 'get_journal':
      return await journalService.getJournal(userId, data);

    // === CÔNG VIỆC ===
    case 'create_task':
      return await taskService.createTask(userId, data);

    case 'update_task':
      return await taskService.updateTask(userId, data);

    case 'complete_task':
      return await taskService.completeTask(userId, data);

    case 'list_tasks_today':
      return await taskService.listTasksToday(userId);

    case 'list_tasks_week':
      return await taskService.listTasksWeek(userId);

    // === NHẮC VIỆC ===
    case 'create_reminder':
      return await reminderService.createReminder(userId, chatId, data);

    case 'list_reminders':
      return await reminderService.listReminders(userId);

    // === KẾ HOẠCH ===
    case 'create_plan':
      return await planService.createPlan(userId, data);

    // === TỔNG QUAN ===
    case 'today_overview':
      return await buildTodayOverview(userId);

    case 'week_overview':
      return await buildWeekOverview(userId);

    // === KHÔNG XÁC ĐỊNH ===
    case 'unknown':
    default:
      return '🤔 Mình chưa hiểu ý bạn. Thử nói rõ hơn nhé!\n\nVí dụ:\n• "Hôm nay tôi dạy mệt" → Ghi nhật ký\n• "Cần soạn giáo án" → Tạo task\n• "3h chiều nhắc họp" → Đặt nhắc việc\n• "Hôm nay cần làm gì?" → Tổng quan ngày';
  }
}

/**
 * Tổng quan ngày hôm nay: task + reminder + plan
 */
async function buildTodayOverview(userId) {
  const [tasks, reminders] = await Promise.all([
    taskService.getTasksToday(userId),
    reminderService.getRemindersToday(userId),
  ]);

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `📅 *TỔNG QUAN HÔM NAY*\n${today}\n\n`;

  // Task hôm nay
  msg += `📋 *Công việc (${tasks.length}):*\n`;
  if (tasks.length === 0) {
    msg += '  ✅ Không có task nào\n';
  } else {
    tasks.forEach((t, i) => {
      const status = t.status === 'done' ? '✅' : '⬜';
      msg += `  ${status} ${i + 1}. ${t.content}\n`;
    });
  }

  msg += '\n';

  // Reminder hôm nay
  msg += `🔔 *Nhắc việc (${reminders.length}):*\n`;
  if (reminders.length === 0) {
    msg += '  Không có nhắc việc nào\n';
  } else {
    reminders.forEach((r) => {
      const time = r.remindAt
        ? new Date(r.remindAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh',
          })
        : '';
      msg += `  🔔 ${time} - ${r.content}\n`;
    });
  }

  return msg;
}

/**
 * Tổng quan tuần này
 */
async function buildWeekOverview(userId) {
  const tasks = await taskService.getTasksWeek(userId);
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  let msg = `📊 *TỔNG QUAN TUẦN NÀY*\n\n`;
  msg += `📋 Tổng tasks: ${tasks.length}\n`;
  msg += `✅ Hoàn thành: ${done.length}\n`;
  msg += `⏳ Còn lại: ${pending.length}\n\n`;

  if (pending.length > 0) {
    msg += `*Việc chưa xong:*\n`;
    pending.slice(0, 5).forEach((t, i) => {
      msg += `  ${i + 1}. ${t.content}\n`;
    });
    if (pending.length > 5) {
      msg += `  _...và ${pending.length - 5} việc khác_\n`;
    }
  }

  return msg;
}

module.exports = { routeAction };
