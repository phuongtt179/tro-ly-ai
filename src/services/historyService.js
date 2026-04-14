/**
 * historyService.js
 * Tìm kiếm lịch sử hoạt động: nhật ký + task đã hoàn thành
 */

const { queryDocs } = require('../firebaseService');

/**
 * Parse ngày từ string
 */
function resolveDate(dateStr) {
  const now = new Date();
  if (!dateStr || dateStr === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (dateStr === 'yesterday') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Tìm kiếm lịch sử theo từ khóa và/hoặc ngày
 */
async function searchHistory(userId, data) {
  const { keyword, date } = data;

  if (!keyword && !date) return '🔍 Bạn muốn tìm gì? Nhập từ khóa hoặc ngày cụ thể nhé.';

  const targetDate = date ? resolveDate(date) : null;

  // Xây dựng filter cho journals
  const journalFilters = [];
  // Xây dựng filter cho tasks và schedule
  const taskFilters = [{ field: 'status', op: '==', value: 'done' }];
  const scheduleFilters = [{ field: 'status', op: '==', value: 'done' }];

  if (targetDate) {
    const start = targetDate.toISOString();
    const end = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    journalFilters.push({ field: 'createdAt', op: '>=', value: start });
    journalFilters.push({ field: 'createdAt', op: '<', value: end });
    taskFilters.push({ field: 'completedAt', op: '>=', value: start });
    taskFilters.push({ field: 'completedAt', op: '<', value: end });
    scheduleFilters.push({ field: 'completedAt', op: '>=', value: start });
    scheduleFilters.push({ field: 'completedAt', op: '<', value: end });
  }

  // Lấy dữ liệu song song
  const [journals, tasks, schedules] = await Promise.all([
    queryDocs(userId, 'journals', journalFilters, { field: 'createdAt', direction: 'desc' }, 100),
    queryDocs(userId, 'tasks', taskFilters, { field: 'completedAt', direction: 'desc' }, 100),
    queryDocs(userId, 'schedule', scheduleFilters, { field: 'completedAt', direction: 'desc' }, 100),
  ]);

  // Lọc theo từ khóa nếu có
  const kw = keyword ? keyword.toLowerCase() : null;
  const matchedJournals = kw
    ? journals.filter((j) => j.content?.toLowerCase().includes(kw))
    : journals;
  const matchedTasks = kw
    ? tasks.filter((t) => t.content?.toLowerCase().includes(kw))
    : tasks;
  const matchedSchedules = kw
    ? schedules.filter((s) => s.content?.toLowerCase().includes(kw))
    : schedules;

  if (matchedJournals.length === 0 && matchedTasks.length === 0 && matchedSchedules.length === 0) {
    const kwStr = keyword ? `"${keyword}"` : '';
    const dateStr = targetDate
      ? targetDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })
      : '';
    return `🔍 Không tìm thấy kết quả nào${kwStr ? ` cho "${keyword}"` : ''}${dateStr ? ` ngày ${dateStr}` : ''}.`;
  }

  // Gộp và sắp xếp theo thời gian mới nhất
  const results = [
    ...matchedJournals.map((j) => ({ type: 'journal', content: j.content, time: j.createdAt })),
    ...matchedTasks.map((t) => ({ type: 'task', content: t.content, time: t.completedAt })),
    ...matchedSchedules.map((s) => ({ type: 'schedule', content: s.content, time: s.completedAt })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  // Format kết quả
  const total = results.length;
  const kwLabel = keyword ? ` "${keyword}"` : '';
  const dateLabel = targetDate
    ? ` ngày ${targetDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })}`
    : '';

  let msg = `🔍 *Kết quả tìm kiếm${kwLabel}${dateLabel} (${total})*\n\n`;

  results.slice(0, 20).forEach((r) => {
    const timeStr = r.time
      ? new Date(r.time).toLocaleDateString('vi-VN', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
        })
      : '';
    const icon = r.type === 'journal' ? '📔' : r.type === 'schedule' ? '📅' : '✅';
    msg += `${icon} ${timeStr}\n   ${r.content}\n\n`;
  });

  if (total > 20) msg += `_...và ${total - 20} kết quả khác_`;

  return msg;
}

module.exports = { searchHistory };
