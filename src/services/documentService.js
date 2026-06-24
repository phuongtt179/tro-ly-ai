/**
 * documentService.js
 * Quản lý tài liệu (text, link, file)
 */

const { addDoc, queryDocs, updateDoc, deleteDoc } = require('../firebaseService');

/**
 * Tạo tài liệu mới
 * data: { content, type, url, file_id, file_name, file_type, file_size, category, description, tags }
 */
async function createDocument(userId, data) {
  if (!data.content && !data.url && !data.file_id) {
    return '❌ Vui lòng cung cấp nội dung hoặc link hoặc file';
  }

  const type = data.type || 'text';
  const category = data.category || 'khác';
  const description = data.description || data.content?.substring(0, 100) || '';
  const tags = Array.isArray(data.tags) ? data.tags : [];

  const doc = {
    type,
    category,
    description,
    tags,
    content: data.content || null,
    url: data.url || null,
    file_id: data.file_id || null,
    file_name: data.file_name || null,
    file_type: data.file_type || null,
    file_size: data.file_size || null,
  };

  await addDoc(userId, 'documents', doc);

  let typeText = '';
  if (type === 'file') typeText = `[${data.file_type?.toUpperCase() || 'File'}]`;
  else if (type === 'link') typeText = '[Link]';
  else typeText = '[Text]';

  return `✅ Đã lưu tài liệu "${description.substring(0, 50)}" ${typeText}\n_Danh mục: ${category}_`;
}

/**
 * Lấy tất cả tài liệu hoặc theo danh mục
 */
async function getDocuments(userId, data) {
  const category = data.category || null;
  const limit = data.limit || 20;

  let filters = [];
  if (category) {
    filters.push({ field: 'category', operator: '==', value: category });
  }

  const docs = await queryDocs(userId, 'documents', filters, { field: 'createdAt', direction: 'desc' }, limit);

  if (docs.length === 0) {
    return category ? `❌ Không tìm thấy tài liệu nào trong danh mục "${category}"` : '❌ Chưa có tài liệu nào';
  }

  let result = `📌 Danh sách tài liệu${category ? ` (${category})` : ''}: (Tìm thấy ${docs.length} TL)\n\n`;

  docs.forEach((doc, idx) => {
    const date = new Date(doc.createdAt.toDate()).toLocaleDateString('vi-VN');
    const typeIcon = doc.type === 'file' ? '📄' : doc.type === 'link' ? '🔗' : '📝';
    const fileType = doc.file_type ? ` [${doc.file_type.toUpperCase()}]` : '';
    const desc = doc.description || doc.content?.substring(0, 40) || 'Không có mô tả';

    result += `${typeIcon} ${desc}${fileType} - ${date}\n`;
  });

  return result;
}

/**
 * Tìm tài liệu theo từ khóa hoặc danh mục
 */
async function searchDocument(userId, data) {
  const keyword = data.keyword || data.content || '';
  const category = data.category || null;
  const limit = 20;

  let filters = [];
  if (category) {
    filters.push({ field: 'category', operator: '==', value: category });
  }

  const allDocs = await queryDocs(userId, 'documents', filters, { field: 'createdAt', direction: 'desc' }, limit);

  let results = [];
  if (keyword.trim()) {
    const keywordLower = keyword.toLowerCase();
    results = allDocs.filter(
      (doc) =>
        doc.description?.toLowerCase().includes(keywordLower) ||
        doc.content?.toLowerCase().includes(keywordLower) ||
        doc.file_name?.toLowerCase().includes(keywordLower) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(keywordLower))
    );
  } else {
    results = allDocs;
  }

  if (results.length === 0) {
    return `❌ Không tìm thấy tài liệu nào phù hợp với "${keyword}"`;
  }

  let output = `📌 Tìm TL ${keyword ? `"${keyword}"` : 'tháng này'}: (Tìm thấy ${results.length} TL)\n\n`;

  results.forEach((doc) => {
    const date = new Date(doc.createdAt.toDate()).toLocaleDateString('vi-VN');
    const typeIcon = doc.type === 'file' ? '📄' : doc.type === 'link' ? '🔗' : '📝';
    const fileType = doc.file_type ? ` [${doc.file_type.toUpperCase()}]` : '';
    const desc = doc.description || doc.content?.substring(0, 40) || 'Không có mô tả';

    output += `${typeIcon} ${desc}${fileType} - ${date}\n`;
  });

  return output;
}

/**
 * Xóa tài liệu
 */
async function deleteDocument(userId, data) {
  const keyword = data.keyword || data.content || '';

  if (!keyword.trim()) {
    return '❌ Vui lòng cung cấp tên tài liệu cần xóa';
  }

  const docs = await queryDocs(userId, 'documents', [], { field: 'createdAt', direction: 'desc' }, 50);

  const keywordLower = keyword.toLowerCase();
  const doc = docs.find(
    (d) =>
      d.description?.toLowerCase().includes(keywordLower) ||
      d.file_name?.toLowerCase().includes(keywordLower) ||
      d.content?.toLowerCase().includes(keywordLower)
  );

  if (!doc) {
    return `❌ Không tìm thấy tài liệu "${keyword}" để xóa`;
  }

  await deleteDoc(userId, 'documents', doc.id);
  return `✅ Đã xóa tài liệu "${doc.description || 'Không tên'}"`;
}

module.exports = {
  createDocument,
  getDocuments,
  searchDocument,
  deleteDocument,
};
