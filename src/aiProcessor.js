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
- create_task: Tạo 1 công việc cần làm (không có ngày cụ thể trong tuần)
- update_task: Cập nhật công việc
- complete_task: Đánh dấu hoàn thành công việc (task thông thường)
- list_tasks_today: Xem danh sách việc hôm nay
- list_tasks_week: Xem danh sách việc tuần này
- create_reminder: Tạo nhắc việc đơn lẻ (có thời gian cụ thể)
- list_reminders: Xem danh sách nhắc việc
- today_overview: Tổng quan hôm nay (task + lịch công tác + reminder)
- tomorrow_overview: Tổng quan ngày mai
- week_overview: Tổng quan tuần này
- create_plan: Tạo kế hoạch dài hạn
- create_schedule: Nhập lịch công tác (1 hoặc nhiều việc có ngày trong tuần)
- add_schedule: Thêm 1 việc vào lịch công tác
- list_schedule: Xem lịch công tác (hôm nay/ngày mai/tuần này/tuần tới)
- update_schedule: Sửa 1 việc trong lịch công tác
- delete_schedule: Xóa 1 việc khỏi lịch công tác
- complete_schedule: Đánh dấu hoàn thành việc trong lịch công tác
- unknown: Không xác định được intent

FORMAT OUTPUT (JSON CHUẨN):
{
  "intent": "tên_intent",
  "data": {
    "content": "nội dung chính",
    "time": "HH:MM (nếu có)",
    "date": "today|tomorrow|YYYY-MM-DD (nếu có)",
    "day": "thứ 2|thứ 3|thứ 4|thứ 5|thứ 6|thứ 7|chủ nhật (nếu có)",
    "week": "this|next (mặc định next nếu nói tuần tới)",
    "priority": "high|medium|low (nếu có)",
    "tags": ["tag1", "tag2"],
    "title": "tiêu đề (nếu là plan)",
    "new_content": "nội dung mới khi sửa",
    "note": "ghi chú thêm nếu có",
    "period": "week|next_week|today|tomorrow (khi xem lịch)",
    "items": [
      {"day": "thứ 2", "content": "nội dung", "time": "HH:MM", "note": "ghi chú"},
      {"day": "thứ 3", "content": "nội dung", "time": null, "note": null}
    ]
  }
}

VÍ DỤ:

Input: "Chiều mai 3h họp tổ nhớ nhắc tôi"
Output: {"intent":"create_reminder","data":{"content":"họp tổ","time":"15:00","date":"tomorrow"}}

Input: "Hôm nay tôi dạy học mệt quá"
Output: {"intent":"create_journal","data":{"content":"Hôm nay tôi dạy học mệt quá"}}

Input: "Hôm nay tôi cần làm gì"
Output: {"intent":"today_overview","data":{}}

Input: "Ngày mai tôi có gì"
Output: {"intent":"tomorrow_overview","data":{}}

Input: "Xem lịch tuần tới"
Output: {"intent":"list_schedule","data":{"period":"next_week"}}

Input: "Xem lịch hôm nay"
Output: {"intent":"list_schedule","data":{"period":"today"}}

Input: "Lịch công tác tuần tới:\n- Thứ 2: họp hội đồng 7h30\n- Thứ 3: dạy bù tiết 3\n- Thứ 5: kiểm tra 1 tiết lớp 11A\n- Thứ 6: nộp báo cáo tháng"
Output: {"intent":"create_schedule","data":{"week":"next","items":[{"day":"thứ 2","content":"họp hội đồng","time":"07:30","note":null},{"day":"thứ 3","content":"dạy bù tiết 3","time":null,"note":null},{"day":"thứ 5","content":"kiểm tra 1 tiết lớp 11A","time":null,"note":null},{"day":"thứ 6","content":"nộp báo cáo tháng","time":null,"note":null}]}}

Input: "Thêm vào lịch thứ 4 tuần tới họp phụ huynh 18h"
Output: {"intent":"add_schedule","data":{"day":"thứ 4","content":"họp phụ huynh","time":"18:00","week":"next"}}

Input: "Sửa lịch họp hội đồng thành 8h"
Output: {"intent":"update_schedule","data":{"content":"họp hội đồng","time":"08:00"}}

Input: "Xóa lịch dạy bù thứ 3"
Output: {"intent":"delete_schedule","data":{"content":"dạy bù"}}

Input: "Xong việc họp hội đồng rồi"
Output: {"intent":"complete_schedule","data":{"content":"họp hội đồng"}}

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
