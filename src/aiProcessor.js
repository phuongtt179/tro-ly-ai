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
- create_journal: Ghi nhật ký, ghi lại cảm xúc/sự kiện hôm nay
- get_journal: Xem lại nhật ký cũ
- create_task: Tạo công việc cần làm
- update_task: Cập nhật công việc
- complete_task: Đánh dấu hoàn thành công việc
- list_tasks_today: Xem danh sách việc hôm nay
- list_tasks_week: Xem danh sách việc tuần này
- create_reminder: Tạo nhắc việc (có thời gian cụ thể)
- list_reminders: Xem danh sách nhắc việc
- today_overview: Tổng quan hôm nay (task + reminder + plan)
- week_overview: Tổng quan tuần này
- create_plan: Tạo kế hoạch
- unknown: Không xác định được intent

FORMAT OUTPUT (JSON CHUẨN):
{
  "intent": "tên_intent",
  "data": {
    "content": "nội dung chính",
    "time": "HH:MM (nếu có)",
    "date": "today|tomorrow|YYYY-MM-DD (nếu có)",
    "priority": "high|medium|low (nếu có)",
    "tags": ["tag1", "tag2"],
    "title": "tiêu đề (nếu là plan)"
  }
}

VÍ DỤ:

Input: "Chiều mai 3h họp tổ nhớ nhắc tôi"
Output: {"intent":"create_reminder","data":{"content":"họp tổ","time":"15:00","date":"tomorrow"}}

Input: "Hôm nay tôi dạy học mệt quá"
Output: {"intent":"create_journal","data":{"content":"Hôm nay tôi dạy học mệt quá"}}

Input: "Cần soạn giáo án cho tiết thứ 4 tuần sau"
Output: {"intent":"create_task","data":{"content":"Soạn giáo án tiết thứ 4","date":"next_week","priority":"medium"}}

Input: "Hôm nay tôi cần làm gì"
Output: {"intent":"today_overview","data":{}}

Input: "Xem lại nhật ký hôm qua"
Output: {"intent":"get_journal","data":{"date":"yesterday"}}

Input: "Tạo kế hoạch ôn thi cuối kỳ"
Output: {"intent":"create_plan","data":{"title":"Ôn thi cuối kỳ"}}

Input: "Xong việc soạn giáo án rồi"
Output: {"intent":"complete_task","data":{"content":"soạn giáo án"}}

Input: "8 giờ tối nay nhắc tôi gọi điện cho phụ huynh"
Output: {"intent":"create_reminder","data":{"content":"gọi điện cho phụ huynh","time":"20:00","date":"today"}}

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
          maxOutputTokens: 512,
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
