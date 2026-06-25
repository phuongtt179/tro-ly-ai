/**
 * zaiProcessor.js
 * Gọi Z.AI API (GLM model) để phân tích intent và trích xuất dữ liệu
 * Interface giống aiProcessor.js — có thể dùng thay thế hoặc song song
 */

const axios = require('axios');

const ZAI_API_KEY = process.env.ZAI_API_KEY;
const ZAI_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
const ZAI_MODEL = 'glm-4-flash';

/**
 * Prompt tối ưu cho GLM model (Z.AI)
 * Bao quát đầy đủ các trường hợp, phân biệt rõ từng intent
 */
function generatePrompt(userMessage) {
  return `Bạn là AI phân tích ý định người dùng. CHỈ trả về JSON thuần túy, KHÔNG có markdown, KHÔNG có giải thích.

==================================================
DANH SÁCH INTENT VÀ QUY TẮC NHẬN DẠNG
==================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NHÓM 1: NK - NHẬT KÝ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] create_journal — GHI nhật ký mới
NHẬN DẠNG: Input bắt đầu bằng "NK" HOẶC mô tả hoạt động/cảm xúc hàng ngày
DATA: {"content": "nội dung gốc (viết thường)", "tags": []}
VÍ DỤ:
  "NK HÔM NAY HỌP MỆT" → {"intent":"create_journal","data":{"content":"hôm nay họp mệt"}}
  "NK NỘP BỔ SUNG GIẤY KHÁM SỨC KHOẺ CHO ĐẢNG UỶ, QUANG NHẬN" → {"intent":"create_journal","data":{"content":"nộp bổ sung giấy khám sức khoẻ cho đảng uỷ, quang nhận"}}
  "NK ĐI DẠO CÔNG VIÊN VUI" → {"intent":"create_journal","data":{"content":"đi dạo công viên vui"}}
  "DẠY HỌC BÀI MỆT" → {"intent":"create_journal","data":{"content":"dạy học bài mệt"}}
  "HÔM NAY HOÀN THÀNH DỰ ÁN" → {"intent":"create_journal","data":{"content":"hôm nay hoàn thành dự án"}}

[2] get_journal — XEM nhật ký ĐÚNG 1 NGÀY CỤ THỂ
NHẬN DẠNG: "XEM NK" + (hôm nay / hôm qua / ngày cụ thể) HOẶC chỉ "XEM NK" không có gì thêm
DATA: {"date": "today|yesterday|YYYY-MM-DD"}
QUAN TRỌNG: CHỈ dùng get_journal khi xem 1 ngày. Nếu có THÁNG/TUẦN/NĂM thì dùng search_journal.
VÍ DỤ:
  "XEM NK" → {"intent":"get_journal","data":{"date":"today"}}
  "XEM NK HÔM NAY" → {"intent":"get_journal","data":{"date":"today"}}
  "XEM NK HÔM QUA" → {"intent":"get_journal","data":{"date":"yesterday"}}
  "XEM NK NGÀY 20/6" → {"intent":"get_journal","data":{"date":"2026-06-20"}}
  "XEM NK NGÀY 15 THÁNG 5" → {"intent":"get_journal","data":{"date":"2026-05-15"}}

[3] search_journal — TÌM hoặc XEM nhật ký theo KHOẢNG THỜI GIAN hoặc TỪ KHÓA
NHẬN DẠNG: bất kỳ input nào chứa THÁNG / TUẦN / NĂM / từ khóa tìm kiếm
DATA tùy trường hợp:
  - Theo từ khóa: {"keyword": "từ khóa"}
  - Theo tháng: {"month": số_tháng, "period": "month"}
  - Theo tháng + năm: {"month": số_tháng, "year": năm, "period": "month"}
  - Theo tuần này: {"week": "this", "period": "week"}
  - Theo tuần trước: {"week": "last", "period": "week"}
  - Theo năm: {"year": năm, "period": "year"}
  - Kết hợp từ khóa + thời gian: {"keyword": "...", "week": "this", "period": "week"}

VÍ DỤ ĐẦY ĐỦ (PHẢI HỌC THUỘC):
  "XEM NK THÁNG 6" → {"intent":"search_journal","data":{"month":6,"period":"month"}}
  "TÌM NK THÁNG 6" → {"intent":"search_journal","data":{"month":6,"period":"month"}}
  "XEM NK THÁNG 5 NĂM 2025" → {"intent":"search_journal","data":{"month":5,"year":2025,"period":"month"}}
  "TÌM NK THÁNG 5 NĂM 2025" → {"intent":"search_journal","data":{"month":5,"year":2025,"period":"month"}}
  "XEM NK TUẦN NÀY" → {"intent":"search_journal","data":{"week":"this","period":"week"}}
  "TÌM NK TUẦN NÀY" → {"intent":"search_journal","data":{"week":"this","period":"week"}}
  "XEM NK TUẦN TRƯỚC" → {"intent":"search_journal","data":{"week":"last","period":"week"}}
  "TÌM NK TUẦN TRƯỚC" → {"intent":"search_journal","data":{"week":"last","period":"week"}}
  "XEM NK NĂM 2025" → {"intent":"search_journal","data":{"year":2025,"period":"year"}}
  "TÌM NK NĂM 2025" → {"intent":"search_journal","data":{"year":2025,"period":"year"}}
  "TÌM NK HỌP" → {"intent":"search_journal","data":{"keyword":"họp"}}
  "TÌM NK MỆT" → {"intent":"search_journal","data":{"keyword":"mệt"}}
  "TÌM NK HỌP TUẦN NÀY" → {"intent":"search_journal","data":{"keyword":"họp","week":"this","period":"week"}}
  "TÌM NK DẠY THÁNG 6" → {"intent":"search_journal","data":{"keyword":"dạy","month":6,"period":"month"}}
  "TÌM NK HÔM QUA" → {"intent":"search_journal","data":{"period":"yesterday"}}

[4] update_journal — SỬA nội dung nhật ký
NHẬN DẠNG: "SỬA NK", "CẬP NHẬT NK", "THAY NK"
DATA: {"date": "today|yesterday|YYYY-MM-DD", "new_content": "nội dung mới"}
VÍ DỤ:
  "SỬA NK HÔM NAY THÀNH HÔM NAY DẠY BÙ HAY" → {"intent":"update_journal","data":{"date":"today","new_content":"hôm nay dạy bù hay"}}
  "CẬP NHẬT NK HÔM QUA THÀNH ĐI ĂN VUI VẺ" → {"intent":"update_journal","data":{"date":"yesterday","new_content":"đi ăn vui vẻ"}}

[5] delete_journal — XÓA nhật ký
NHẬN DẠNG: "XÓA NK"
DATA: {"date": "today|yesterday|YYYY-MM-DD"}
VÍ DỤ:
  "XÓA NK HÔM QUA" → {"intent":"delete_journal","data":{"date":"yesterday"}}
  "XÓA NK HÔM NAY" → {"intent":"delete_journal","data":{"date":"today"}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NHÓM 2: TL - TÀI LIỆU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[6] create_document — LƯU tài liệu mới
NHẬN DẠNG: bắt đầu bằng "TL" + nội dung/link/mô tả
CATEGORY tự động phân loại: giáo_án | báo_cáo | tham_khảo | link | hình_ảnh | khác
DATA:
  - Text: {"type":"text","content":"...","category":"...","description":"...","tags":[]}
  - Link: {"type":"link","url":"https://...","description":"...","category":"link","tags":[]}
VÍ DỤ:
  "TL ĐÂY LÀ CÔNG THỨC TÍNH LƯƠNG BÌNH QUÂN" → {"intent":"create_document","data":{"type":"text","content":"đây là công thức tính lương bình quân","category":"khác","description":"công thức tính lương bình quân"}}
  "TL HTTPS://EXAMPLE.COM TÀI LIỆU THAM KHẢO TOÁN" → {"intent":"create_document","data":{"type":"link","url":"https://example.com","description":"tài liệu tham khảo toán","category":"tham_khảo"}}
  "TL GIÁO ÁN TUẦN 3 MÔN TOÁN" → {"intent":"create_document","data":{"type":"text","description":"giáo án tuần 3 môn toán","category":"giáo_án","content":"giáo án tuần 3 môn toán","tags":["tuần 3","toán"]}}
  "TL BÁO CÁO THÁNG 6" → {"intent":"create_document","data":{"type":"text","description":"báo cáo tháng 6","category":"báo_cáo","content":"báo cáo tháng 6"}}

[7] get_documents — XEM danh sách tài liệu
NHẬN DẠNG: "XEM TL" (có hoặc không có danh mục)
DATA: {} hoặc {"category": "tên_danh_mục"}
VÍ DỤ:
  "XEM TL" → {"intent":"get_documents","data":{}}
  "XEM TL BÁO CÁO" → {"intent":"get_documents","data":{"category":"báo_cáo"}}
  "XEM TL GIÁO ÁN" → {"intent":"get_documents","data":{"category":"giáo_án"}}
  "DANH SÁCH TL" → {"intent":"get_documents","data":{}}

[8] search_document — TÌM tài liệu theo từ khóa hoặc danh mục
NHẬN DẠNG: "TÌM TL"
DATA: {"keyword": "...", "category": "..."}
VÍ DỤ:
  "TÌM TL GIÁO ÁN" → {"intent":"search_document","data":{"keyword":"giáo án"}}
  "TÌM TL LƯƠNG" → {"intent":"search_document","data":{"keyword":"lương"}}
  "TÌM TL DANH MỤC BÁO CÁO" → {"intent":"search_document","data":{"category":"báo_cáo"}}
  "TÌM TL TOÁN TUẦN 3" → {"intent":"search_document","data":{"keyword":"toán tuần 3"}}

[9] delete_document — XÓA tài liệu
NHẬN DẠNG: "XÓA TL"
DATA: {"keyword": "tên hoặc mô tả tài liệu cần xóa"}
VÍ DỤ:
  "XÓA TL GIÁO ÁN TUẦN 3" → {"intent":"delete_document","data":{"keyword":"giáo án tuần 3"}}
  "XÓA TL BÁO CÁO THÁNG 6" → {"intent":"delete_document","data":{"keyword":"báo cáo tháng 6"}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NHÓM 3: KHÔNG XÁC ĐỊNH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[10] unknown — Không xác định được intent
Dùng khi input không khớp với bất kỳ intent nào ở trên.
DATA: {"content": "nội dung gốc"}

==================================================
QUY TẮC BẮT BUỘC
==================================================
1. "XEM NK THÁNG/TUẦN/NĂM" = search_journal (KHÔNG phải get_journal)
2. "XEM NK HÔM NAY/HÔM QUA/ngày cụ thể" = get_journal
3. "XEM NK" không có gì thêm = get_journal với date: "today"
4. Cả "XEM" và "TÌM" đều có thể trigger search_journal khi có tháng/tuần/năm/từ khóa
5. content trong create_journal phải viết thường (lowercase)
6. Chỉ trả về JSON, không có text khác

==================================================
INPUT CẦN PHÂN TÍCH:
==================================================
"${userMessage}"`;
}

/**
 * Pre-process các pattern phổ biến trước khi gọi AI
 * Xử lý các trường hợp GLM hay nhầm intent
 * Trả về result nếu match, null nếu để AI xử lý
 */
function preProcess(userMessage) {
  const msg = userMessage.toUpperCase().trim();

  // XEM NK THÁNG X → search_journal theo tháng
  const monthMatch = msg.match(/(?:XEM|TÌM)\s+NK\s+THÁNG\s+(\d{1,2})/);
  if (monthMatch) {
    return { intent: 'search_journal', data: { month: parseInt(monthMatch[1]), period: 'month' } };
  }

  // XEM NK NĂM X → search_journal theo năm
  const yearMatch = msg.match(/(?:XEM|TÌM)\s+NK\s+NĂM\s+(\d{4})/);
  if (yearMatch) {
    return { intent: 'search_journal', data: { year: parseInt(yearMatch[1]), period: 'year' } };
  }

  // XEM NK TUẦN NÀY/TUẦN TRƯỚC → search_journal theo tuần
  if (msg.match(/(?:XEM|TÌM)\s+NK\s+TUẦN\s+NÀY/)) {
    return { intent: 'search_journal', data: { week: 'this', period: 'week' } };
  }
  if (msg.match(/(?:XEM|TÌM)\s+NK\s+TUẦN\s+TRƯỚC/)) {
    return { intent: 'search_journal', data: { week: 'last', period: 'week' } };
  }

  return null;
}

/**
 * Gửi message đến Z.AI và nhận kết quả JSON
 */
async function processMessage(userMessage) {
  // Thử pre-process trước
  const preResult = preProcess(userMessage);
  if (preResult) {
    console.log('[ZAI] Pre-processed intent:', preResult.intent);
    return preResult;
  }

  const prompt = generatePrompt(userMessage);

  try {
    const response = await axios.post(
      ZAI_URL,
      {
        model: ZAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1024,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ZAI_API_KEY}`,
        },
        timeout: 15000,
      }
    );

    const rawText = response.data?.choices?.[0]?.message?.content || '';
    console.log('[ZAI] Raw response:', rawText);

    const result = parseJsonFromText(rawText);
    console.log('[ZAI] Parsed intent:', result.intent);

    return result;
  } catch (err) {
    console.error('[ZAI] Lỗi gọi Z.AI:', err.message);
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
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // ignore
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // ignore
      }
    }

    console.error('[ZAI] Không parse được JSON:', text);
    return { intent: 'unknown', data: { content: text } };
  }
}

module.exports = { processMessage, generatePrompt };
