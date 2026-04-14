/**
 * planService.js
 * Quản lý kế hoạch
 */

const { addDoc, queryDocs, deleteDoc } = require('../firebaseService');

/**
 * Tạo kế hoạch mới
 */
async function createPlan(userId, data) {
  const { title, content, date, tasks = [] } = data;

  const planTitle = title || content;
  if (!planTitle) return '📅 Kế hoạch này về chủ đề gì?';

  const planDate = date
    ? new Date(date === 'today' ? Date.now() : date).toISOString()
    : new Date().toISOString();

  const docId = await addDoc(userId, 'plans', {
    title: planTitle,
    tasks: tasks,
    date: planDate,
    status: 'active',
  });

  return `📅 *Đã tạo kế hoạch:*\n\n📌 ${planTitle}\n🗂 ID: \`${docId}\`\n\n_Bạn có thể thêm tasks vào kế hoạch này sau._`;
}

/**
 * Liệt kê kế hoạch
 */
async function listPlans(userId) {
  const plans = await queryDocs(userId, 'plans', [
    { field: 'status', op: '==', value: 'active' },
  ], { field: 'createdAt', direction: 'desc' }, 10);

  if (plans.length === 0) return '📅 Chưa có kế hoạch nào.';

  let msg = `📅 *KẾ HOẠCH (${plans.length})*\n\n`;
  plans.forEach((p, i) => {
    const dateStr = new Date(p.date).toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    msg += `${i + 1}. 📌 *${p.title}*\n   📅 ${dateStr}\n   🗂 ${p.tasks?.length || 0} tasks\n\n`;
  });

  return msg;
}

/**
 * Xóa kế hoạch
 */
async function deletePlan(userId, data) {
  const { content } = data;
  if (!content) return '❓ Kế hoạch nào bạn muốn xóa?';

  const plans = await queryDocs(userId, 'plans', [
    { field: 'status', op: '==', value: 'active' },
  ]);

  const keyword = content.toLowerCase();
  const match = plans.find((p) => p.title.toLowerCase().includes(keyword));
  if (!match) return `❌ Không tìm thấy kế hoạch "${content}".`;

  await deleteDoc(userId, 'plans', match.id);
  return `🗑 Đã xóa kế hoạch: *${match.title}*`;
}

module.exports = { createPlan, listPlans, deletePlan };
