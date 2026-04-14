/**
 * journalService.js
 * Quản lý nhật ký cá nhân
 */

const { addDoc, queryDocs, updateDoc, deleteDoc } = require('../firebaseService');

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

/**
 * Tìm journal theo ngày và keyword (dùng chung cho update/delete)
 */
async function findJournal(userId, data) {
  const { date, content } = data;

  let targetDate = new Date();
  if (date === 'yesterday') {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (date && date !== 'today') {
    targetDate = new Date(date);
  }

  const targetDateStr = targetDate.toISOString().split('T')[0];
  const journals = await queryDocs(userId, 'journals', [], { field: 'createdAt', direction: 'desc' }, 50);
  const dayJournals = journals.filter((j) => (j.createdAt?.split('T')[0] || '') === targetDateStr);

  if (dayJournals.length === 0) return null;

  if (content) {
    const keyword = content.toLowerCase();
    return dayJournals.find((j) => j.content.toLowerCase().includes(keyword)) || dayJournals[0];
  }

  return dayJournals[0];
}

/**
 * Sửa nội dung nhật ký
 */
async function updateJournal(userId, data) {
  const { new_content } = data;
  if (!new_content) return '📝 Nội dung mới là gì?';

  const match = await findJournal(userId, data);
  if (!match) return '📔 Không tìm thấy nhật ký để sửa.';

  await updateDoc(userId, 'journals', match.id, { content: new_content });
  return `✏️ *Đã sửa nhật ký:*\n\n"${new_content}"`;
}

/**
 * Xóa nhật ký
 */
async function deleteJournal(userId, data) {
  const match = await findJournal(userId, data);
  if (!match) return '📔 Không tìm thấy nhật ký để xóa.';

  await deleteDoc(userId, 'journals', match.id);
  return `🗑 Đã xóa nhật ký:\n\n"${match.content}"`;
}

module.exports = { createJournal, getJournal, updateJournal, deleteJournal };
