/**
 * aiProcessor.js
 * Gọi Gemini API để phân tích intent và trích xuất dữ liệu
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Tạo prompt gửi cho Gemini
 */
function generatePrompt(userMessage) {
  return `Bạn là AI phân tích ý định người dùng cho ứng dụng trợ lý cá nhân.

NHIỆM VỤ:
1. Xác định intent từ danh sách bên dưới
2. Trích xuất dữ liệu liên quan
3. Chỉ trả về JSON thuần túy, KHÔNG có markdown, KHÔNG có text giải thích

DANH SÁCH INTENT:
NK - NHẬT KÝ (prefix: "NK" hoặc không có prefix nhưng là kể sự kiện/cảm xúc):
- create_journal: Ghi nhật ký (dùng khi gõ "NK ..." hoặc kể lại sự kiện/cảm xúc hàng ngày)
- get_journal: Xem nhật ký (hôm nay, hôm qua, khoảng ngày)
- update_journal: Sửa nội dung nhật ký
- delete_journal: Xóa nhật ký
- search_journal: Tìm nhật ký theo từ khóa hoặc khoảng thời gian (tuần, tháng, năm)

TL - TÀI LIỆU (prefix: "TL" hoặc là lưu link/ghi chú lâu dài):
- create_document: Lưu tài liệu (dùng khi gõ "TL ..." hoặc gửi file/link). Phân loại: type (text|link|file), category (giáo_án|báo_cáo|tham_khảo|link|hình_ảnh|khác)
- get_documents: Xem danh sách tất cả tài liệu hoặc theo danh mục
- search_document: Tìm tài liệu theo từ khóa hoặc danh mục
- delete_document: Xóa tài liệu

UNKNOWN:
- unknown: Không xác định được intent

LƯU Ý: Input từ user sẽ được chuẩn hóa (chuyển UPPERCASE) trước khi gửi tới bạn.

FORMAT OUTPUT (JSON CHUẨN):
{
  "intent": "tên_intent",
  "data": {
    "content": "nội dung chính",
    "keyword": "từ khóa tìm kiếm",
    "period": "today|yesterday|week|month|year",
    "month": "số tháng (1-12)",
    "year": "năm",
    "date": "today|yesterday|tomorrow|YYYY-MM-DD",
    "day": "thứ 2|thứ 3|thứ 4|thứ 5|thứ 6|thứ 7|chủ nhật",
    "week": "this|next",
    "new_content": "nội dung mới khi sửa",
    "url": "http://... (nếu là link)",
    "type": "text|link|file (loại tài liệu)",
    "category": "giáo_án|báo_cáo|tham_khảo|link|hình_ảnh|khác",
    "description": "mô tả tài liệu",
    "tags": ["tag1", "tag2"]
  }
}

VÍ DỤ:

NK - NHẬT KÝ:
Input: "NK HÔM NAY HỌP MỆT QUÁ"
Output: {"intent":"create_journal","data":{"content":"hôm nay họp mệt quá"}}

Input: "NK DẠY TIN CÓ NHI MỎI VÀO"
Output: {"intent":"create_journal","data":{"content":"dạy tin có nhi mỏi vào"}}

Input: "DẠY HỌC BÀI MỆT"
Output: {"intent":"create_journal","data":{"content":"Dạy học bài mệt"}}

Input: "XEM NK HÔM NAY"
Output: {"intent":"get_journal","data":{"date":"today"}}

Input: "XEM NK THÁNG 6"
Output: {"intent":"search_journal","data":{"month":6,"period":"month"}}

Input: "TÌM NK HỌP"
Output: {"intent":"search_journal","data":{"keyword":"họp"}}

Input: "TÌM NK TUẦN NÀY"
Output: {"intent":"search_journal","data":{"week":"this"}}

Input: "TÌM NK THÁNG 6"
Output: {"intent":"search_journal","data":{"month":6}}

Input: "XEM NK"
Output: {"intent":"get_journal","data":{"date":"today"}}

Input: "XEM NK THÁNG 6"
Output: {"intent":"search_journal","data":{"month":6}}

Input: "SỬA NK HÔM NAY THÀNH HÔM NAY DẠY BÙ HAY"
Output: {"intent":"update_journal","data":{"date":"today","new_content":"hôm nay dạy bù hay"}}

Input: "XÓA NK HÔM QUA"
Output: {"intent":"delete_journal","data":{"date":"yesterday"}}

TL - TÀI LIỆU:
Input: "TL ĐÂY LÀ CÔNG THỨC TÍNH LƯƠNG BÌNH QUÂN"
Output: {"intent":"create_document","data":{"content":"đây là công thức tính lương bình quân","type":"text","category":"khác"}}

Input: "TL HTTPS://EXAMPLE.COM TÀI LIỆU THAM KHẢO TOÁN"
Output: {"intent":"create_document","data":{"url":"https://example.com","description":"tài liệu tham khảo toán","type":"link","category":"tham_khảo"}}

Input: "TL GHI CHÚ CÔNG THỨC TÍNH LƯƠNG"
Output: {"intent":"create_document","data":{"content":"ghi chú công thức tính lương","type":"text","category":"khác"}}

Input: "XEM TL"
Output: {"intent":"get_documents","data":{}}

Input: "TÌM TL GIÁO ÁN"
Output: {"intent":"search_document","data":{"keyword":"giáo án"}}

Input: "TÌM TL DANH MỤC BÁO CÁO"
Output: {"intent":"search_document","data":{"category":"báo_cáo"}}

Input: "XÓA TL GIÁO ÁN TUẦN 3"
Output: {"intent":"delete_document","data":{"keyword":"giáo án tuần 3"}}

USER INPUT: "${userMessage}"`;
}

/**
 * Gửi message đến Gemini và nhận kết quả JSON
 */
async function processMessage(userMessage) {
  const prompt = generatePrompt(userMessage);

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Thấp để output ổn định
          maxOutputTokens: 1024,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    // Lấy text từ response Gemini
    const rawText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[AI] Raw response:', rawText);

    // Parse JSON từ response
    const result = parseJsonFromText(rawText);
    console.log('[AI] Parsed intent:', result.intent);

    return result;
  } catch (err) {
    console.error('[AI] Lỗi gọi Gemini:', err.message);
    // Fallback nếu AI lỗi
    return {
      intent: 'unknown',
      data: { content: userMessage },
    };
  }
}

/**
 * Parse JSON từ text (xử lý trường hợp có markdown code block)
 */
function parseJsonFromText(text) {
  try {
    // Thử parse trực tiếp
    return JSON.parse(text.trim());
  } catch {
    // Xử lý nếu Gemini wrap trong ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // ignore
      }
    }

    // Tìm JSON object trong text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // ignore
      }
    }

    console.error('[AI] Không parse được JSON:', text);
    return { intent: 'unknown', data: { content: text } };
  }
}

module.exports = { processMessage, generatePrompt };
