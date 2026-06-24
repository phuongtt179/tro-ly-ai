/**
 * actionRouter.js
 * Nhận intent + data từ AI, điều hướng đến service tương ứng
 */

const journalService = require('./services/journalService');
const documentService = require('./services/documentService');

/**
 * Route action dựa vào intent từ AI
 */
async function routeAction(aiResult, userId, chatId) {
  const { intent, data } = aiResult;

  console.log(`[ROUTER] Intent: ${intent}`, data);

  switch (intent) {
    // === NK - NHẬT KÝ ===
    case 'create_journal':
      return await journalService.createJournal(userId, data);
    case 'get_journal':
      return await journalService.getJournal(userId, data);
    case 'update_journal':
      return await journalService.updateJournal(userId, data);
    case 'delete_journal':
      return await journalService.deleteJournal(userId, data);
    case 'search_journal':
      return await journalService.searchJournal(userId, data);

    // === TL - TÀI LIỆU ===
    case 'create_document':
      const createResult = await documentService.createDocument(userId, data);
      return { text: createResult, documents: [] };
    case 'get_documents':
      return await documentService.getDocuments(userId, data);
    case 'search_document':
      return await documentService.searchDocument(userId, data);
    case 'delete_document':
      const deleteResult = await documentService.deleteDocument(userId, data);
      return { text: deleteResult, documents: [] };

    // === KHÔNG XÁC ĐỊNH ===
    case 'unknown':
    default:
      return (
        '🤔 Mình chưa hiểu ý bạn. Thử nói rõ hơn nhé!\n\n' +
        '📔 *Nhật Ký (NK):*\n' +
        '• NK hôm nay họp mệt → Ghi NK\n' +
        '• Xem NK hôm nay → Xem NK hôm nay\n' +
        '• Tìm NK tháng 6 → Tìm NK theo tháng\n' +
        '• Sửa NK hôm nay thành... → Sửa NK\n' +
        '\n📁 *Tài Liệu (TL):*\n' +
        '• TL https://example.com giáo án → Lưu link\n' +
        '• TL ghi chú lương... → Lưu text\n' +
        '• Xem TL → Xem danh sách tài liệu\n' +
        '• Tìm TL giáo án → Tìm tài liệu'
      );
  }
}

module.exports = { routeAction };
