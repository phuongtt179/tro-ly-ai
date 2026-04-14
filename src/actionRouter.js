/**
 * actionRouter.js
 * Nhận intent + data từ AI, điều hướng đến service tương ứng
 */

const journalService = require('./services/journalService');
const taskService = require('./services/taskService');
const reminderService = require('./services/reminderService');
const planService = require('./services/planService');
const scheduleService = require('./services/scheduleService');

/**
 * Route action dựa vào intent từ AI
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
    case 'update_journal':
      return await journalService.updateJournal(userId, data);
    case 'delete_journal':
      return await journalService.deleteJournal(userId, data);

    // === CÔNG VIỆC ===
    case 'create_task':
      return await taskService.createTask(userId, chatId, data);
    case 'update_task':
      return await taskService.updateTask(userId, data);
    case 'delete_task':
      return await taskService.deleteTask(userId, data);
    case 'complete_task':
      return await taskService.completeTask(userId, data);
    case 'list_tasks_today':
      return await taskService.listTasksToday(userId);
    case 'list_tasks_week':
      return await taskService.listTasksWeek(userId);

    // === NHẮC VIỆC ===
    case 'create_reminder':
      return await reminderService.createReminder(userId, chatId, data);
    case 'update_reminder':
      return await reminderService.updateReminder(userId, data);
    case 'delete_reminder':
      return await reminderService.deleteReminder(userId, data);
    case 'list_reminders':
      return await reminderService.listReminders(userId);

    // === KẾ HOẠCH ===
    case 'create_plan':
      return await planService.createPlan(userId, data);
    case 'delete_plan':
      return await planService.deletePlan(userId, data);

    // === LỊCH CÔNG TÁC ===
    case 'create_schedule': {
      const weekOffset = data.week === 'this' ? 0 : 1;
      return await scheduleService.createScheduleBatch(userId, chatId, data.items, weekOffset);
    }
    case 'add_schedule': {
      const weekOffset = data.week === 'this' ? 0 : 1;
      // Dùng resolveDayOfWeek qua addScheduleItem
      return await scheduleService.addScheduleItem(userId, chatId, { ...data, weekOffset });
    }
    case 'list_schedule':
      return await scheduleService.listSchedule(userId, data);
    case 'update_schedule':
      return await scheduleService.updateScheduleItem(userId, data);
    case 'delete_schedule':
      return await scheduleService.deleteScheduleItem(userId, data);
    case 'complete_schedule':
      return await scheduleService.completeScheduleItem(userId, data);

    // === TỔNG QUAN ===
    case 'today_overview':
      return await buildOverview(userId, new Date());
    case 'tomorrow_overview': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return await buildOverview(userId, tomorrow);
    }
    case 'week_overview':
      return await buildWeekOverview(userId);

    // === KHÔNG XÁC ĐỊNH ===
    case 'unknown':
    default:
      return (
        '🤔 Mình chưa hiểu ý bạn. Thử nói rõ hơn nhé!\n\n' +
        '• "Hôm nay dạy mệt" → Ghi nhật ký\n' +
        '• "Cần soạn giáo án" → Tạo task\n' +
        '• "3h chiều nhắc họp" → Đặt nhắc việc\n' +
        '• "Hôm nay cần làm gì?" → Tổng quan ngày\n' +
        '• "Lịch công tác tuần tới:..." → Nhập lịch cả tuần\n' +
        '• "Xem lịch ngày mai" → Xem lịch công tác'
      );
  }
}

/**
 * Tổng quan 1 ngày: lịch công tác + task + reminder
 */
async function buildOverview(userId, date) {
  const isToday = date.toDateString() === new Date().toDateString();
  const label = isToday ? 'HÔM NAY' : 'NGÀY MAI';

  const dateStr = date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const [tasks, reminders, scheduleItems] = await Promise.all([
    isToday ? taskService.getTasksToday(userId) : taskService.getTasksByDate(userId, date),
    isToday ? reminderService.getRemindersToday(userId) : reminderService.getRemindersByDate(userId, date),
    scheduleService.getScheduleByDate(userId, date),
  ]);

  let msg = `📅 *TỔNG QUAN ${label}*\n${dateStr}\n`;

  // Lịch công tác
  msg += `\n📌 *Lịch công tác (${scheduleItems.length}):*\n`;
  if (scheduleItems.length === 0) {
    msg += '  _Không có lịch_\n';
  } else {
    scheduleItems.forEach((s) => {
      const status = s.status === 'done' ? '✅' : '📌';
      const timeStr = s.time ? ` 🕐${s.time}` : '';
      msg += `  ${status}${timeStr} ${s.content}\n`;
    });
  }

  // Task
  msg += `\n📋 *Công việc (${tasks.length}):*\n`;
  if (tasks.length === 0) {
    msg += '  _Không có task_\n';
  } else {
    tasks.forEach((t) => {
      const status = t.status === 'done' ? '✅' : '⬜';
      msg += `  ${status} ${t.content}\n`;
    });
  }

  // Reminder
  msg += `\n🔔 *Nhắc việc (${reminders.length}):*\n`;
  if (reminders.length === 0) {
    msg += '  _Không có nhắc việc_\n';
  } else {
    reminders.forEach((r) => {
      const time = r.remindAt
        ? new Date(r.remindAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh',
          })
        : '';
      msg += `  🔔 ${time} ${r.content}\n`;
    });
  }

  return msg;
}

/**
 * Tổng quan tuần này: lịch công tác + task
 */
async function buildWeekOverview(userId) {
  const tasks = await taskService.getTasksWeek(userId);
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  // Lịch công tác tuần này
  const scheduleItems = await scheduleService.listSchedule(userId, { period: 'week' });

  let msg = `📊 *TỔNG QUAN TUẦN NÀY*\n\n`;
  msg += scheduleItems + '\n\n';
  msg += `📋 *Tasks:* ${tasks.length} tổng | ✅ ${done.length} xong | ⏳ ${pending.length} còn lại\n`;

  if (pending.length > 0) {
    msg += `\n*Việc chưa xong:*\n`;
    pending.slice(0, 5).forEach((t, i) => {
      msg += `  ${i + 1}. ${t.content}\n`;
    });
    if (pending.length > 5) msg += `  _...và ${pending.length - 5} việc khác_\n`;
  }

  return msg;
}

module.exports = { routeAction };
