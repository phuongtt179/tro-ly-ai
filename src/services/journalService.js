/**
 * journalService.js
 * Quản lý nhật ký cá nhân
 */

const { addDoc, queryDocs } = require('../firebaseService');

/**
 * Ghi nhật ký mới
 */
async function createJournal(userId, data) {
  const { content, tags = [] } = data;

  if (!content) {
    return '📝 Bạn muốn ghi gì vào nhật ký?';
  }

  await addDoc(userId, 'journals', {
    content,
    tags,
    createdAt: new Date().toISOString(),
  });

  const time = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  return `📔 *Đã ghi nhật ký lúc ${time}*\n\n"${content}"\n\n_Cảm xúc của bạn đã được lưu lại._`;
}

/**
 * Xem lại nhật ký
 */
async function getJournal(userId, data) {
  const { date } = data;

  // Xác định ngày cần xem
  let targetDate = new Date();
  if (date === 'yesterday') {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (date && date !== 'today') {
    targetDate = new Date(date);
  }

  const dateStr = targetDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  // Lấy journals, sắp xếp mới nhất
  const journals = await queryDocs(userId, 'journals', [], {
    field: 'createdAt',
    direction: 'desc',
  }, 20);

  // Lọc theo ngày (so sánh chuỗi date đầu)
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const dayJournals = journals.filter((j) => {
    const jDate = j.createdAt?.split('T')[0] || '';
    return jDate === targetDateStr;
  });

  if (dayJournals.length === 0) {
    return `📔 Không có nhật ký nào ngày ${dateStr}`;
  }

  let msg = `📔 *Nhật ký ${dateStr}*\n\n`;
  dayJournals.forEach((j, i) => {
    const time = j.createdAt
      ? new Date(j.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
        })
      : '';
    msg += `🕐 ${time}\n"${j.content}"\n`;
    if (j.tags && j.tags.length > 0) {
      msg += `🏷 ${j.tags.join(', ')}\n`;
    }
    if (i < dayJournals.length - 1) msg += '\n---\n\n';
  });

  return msg;
}

module.exports = { createJournal, getJournal };
