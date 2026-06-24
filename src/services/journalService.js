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
    // Convert Timestamp to string
    const jDateStr = j.createdAt?.toDate?.()?.toISOString?.() || j.createdAt || '';
    const jDate = jDateStr.split('T')[0];
    return jDate === targetDateStr;
  });

  if (dayJournals.length === 0) {
    return `📔 Không có nhật ký nào ngày ${dateStr}`;
  }

  let msg = `📔 *Nhật ký ${dateStr}*\n\n`;
  dayJournals.forEach((j, i) => {
    let time = '';
    if (j.createdAt) {
      const date = j.createdAt.toDate ? j.createdAt.toDate() : new Date(j.createdAt);
      time = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    }
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
  const dayJournals = journals.filter((j) => {
    const jDateStr = j.createdAt?.toDate?.()?.toISOString?.() || j.createdAt || '';
    return jDateStr.split('T')[0] === targetDateStr;
  });

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

/**
 * Tìm nhật ký theo từ khóa và khoảng thời gian
 */
async function searchJournal(userId, data) {
  const { keyword, period, month, year, day, week } = data;
  const now = new Date();
  const currentYear = now.getFullYear();

  let startDate, endDate;

  // Xác định khoảng thời gian
  if (period === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (period === 'yesterday') {
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);
  } else if (period === 'week' || week === 'this') {
    const dayOfWeek = now.getDay() || 7;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek + 2);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
  } else if (week === 'next') {
    const dayOfWeek = now.getDay() || 7;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek + 9);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
  } else if (month) {
    const y = year || currentYear;
    startDate = new Date(y, month - 1, 1);
    endDate = new Date(y, month, 1);
  } else if (year) {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year + 1, 0, 1);
  } else {
    startDate = new Date(currentYear, now.getMonth(), 1);
    endDate = new Date(currentYear, now.getMonth() + 1, 1);
  }

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const journals = await queryDocs(userId, 'journals', [], { field: 'createdAt', direction: 'desc' }, 200);

  let results = journals.filter((j) => {
    const jDateStr = j.createdAt?.toDate?.()?.toISOString?.() || j.createdAt || '';
    const jDate = jDateStr.split('T')[0];
    return jDate >= startStr && jDate < endStr;
  });

  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    results = results.filter((j) => j.content.toLowerCase().includes(keywordLower));
  }

  if (results.length === 0) {
    return `❌ Không tìm thấy nhật ký nào phù hợp`;
  }

  let periodText = '';
  if (period === 'today') periodText = 'hôm nay';
  else if (period === 'yesterday') periodText = 'hôm qua';
  else if (week === 'this') periodText = 'tuần này';
  else if (week === 'next') periodText = 'tuần tới';
  else if (month) periodText = `tháng ${month}`;
  else if (year) periodText = `năm ${year}`;

  let output = `📌 Tìm NK${keyword ? ` "${keyword}"` : ''} ${periodText}: (Tìm thấy ${results.length} NK)\n\n`;

  results.forEach((j) => {
    const dateObj = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt);
    const date = dateObj.toLocaleDateString('vi-VN');
    output += `📅 ${date} - ${j.content.substring(0, 60)}${j.content.length > 60 ? '...' : ''}\n`;
  });

  return output;
}

module.exports = { createJournal, getJournal, updateJournal, deleteJournal, searchJournal };
