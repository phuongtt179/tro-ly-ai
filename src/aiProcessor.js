/**
 * aiProcessor.js
 * Gọi Gemini API để phân tích intent và trích xuất dữ liệu
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

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
NK - NHẬT KÝ (prefix: "NK" hoặc bất kỳ text mà là kể sự kiện/cảm xúc/hoạt động):
- create_journal: Ghi nhật ký - LÀ bất kỳ input nào bắt đầu "NK" hoặc mô tả hoạt động/cảm xúc hàng ngày
  * "NK hôm nay họp mệt" → ghi NK
  * "NK hoàn thành game" → ghi NK
  * "NK đi dạo công viên" → ghi NK
  * "Dạy học bài mệt" → ghi NK (không cần prefix)
- get_journal: Xem nhật ký một ngày cụ thể (hôm nay, hôm qua, YYYY-MM-DD)
- update_journal: Sửa nội dung nhật ký
- delete_journal: Xóa nhật ký
- search_journal: Tìm nhật ký - CÓ THỂ:
  * Theo từ khóa: "TÌM NK HỌP" → {keyword: "họp"}
  * Theo ngày: "TÌM NK HÔM QUA" → {period: "yesterday"}
  * Theo tuần: "TÌM NK TUẦN NÀY" → {week: "this", period: "week"}
  * Theo tháng: "TÌM NK THÁNG 6" → {month: 6, period: "month"}
  * Theo năm: "TÌM NK NĂM 2025" → {year: 2025, period: "year"}
  * Kết hợp: "TÌM NK HỌP TUẦN NÀY" → {keyword: "họp", week: "this", period: "week"}

TL - TÀI LIỆU (prefix: "TL" hoặc là lưu link/ghi chú lâu dài):
- create_document: Lưu tài liệu (dùng khi gõ "TL ..." hoặc gửi file/link). Auto-classify:
  * type: text|link|file
  * category: giáo_án|báo_cáo|tham_khảo|link|hình_ảnh|khác
- get_documents: Xem danh sách tất cả tài liệu hoặc theo danh mục cụ thể
- search_document: Tìm tài liệu - CÓ THỂ:
  * Theo từ khóa: "TÌM TL GIÁO ÁN" → {keyword: "giáo án"}
  * Theo danh mục: "TÌM TL DANH MỤC BÁO CÁO" → {category: "báo_cáo"}
  * Kết hợp: "TÌM TL GIÁO ÁN #TUẦN 3" → {keyword: "giáo án", tags: ["tuần 3"]}
- delete_document: Xóa tài liệu theo tên/mô tả

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

// ============================================================
// PRE-PROCESSING: Xử lý trực tiếp các lệnh rõ ràng, không cần AI
// userMessage đã được toUpperCase() từ telegramHandler
// ============================================================

function preProcess(msg) {
  msg = msg.trim();

  // ── NK: GHI nhật ký ──────────────────────────────────────
  if (/^NK\s+/.test(msg)) {
    return { intent: 'create_journal', data: { content: msg.slice(msg.indexOf(' ')).trim().toLowerCase() } };
  }

  // ── NK: XÓA nhật ký ──────────────────────────────────────
  if (/^X[ÓO]A\s+NK/.test(msg)) {
    const rest = msg.replace(/^X[ÓO]A\s+NK\s*/, '').trim();
    return { intent: 'delete_journal', data: { date: parseDateStr(rest) || 'today' } };
  }

  // ── NK: SỬA nhật ký ──────────────────────────────────────
  if (/^(S[ỬU]A|C[ẬA]P\s+NH[ẬA]T)\s+NK/.test(msg)) {
    const thanhIdx = msg.indexOf(' THÀNH ');
    if (thanhIdx > -1) {
      const prefixEnd = msg.match(/^(S[ỬU]A|C[ẬA]P\s+NH[ẬA]T)\s+NK\s*/)[0].length;
      const datePart = msg.slice(prefixEnd, thanhIdx).trim();
      const newContent = msg.slice(thanhIdx + 7).trim().toLowerCase();
      return { intent: 'update_journal', data: { date: parseDateStr(datePart) || 'today', new_content: newContent } };
    }
  }

  // ── NK: XEM nhật ký ──────────────────────────────────────
  const xemNk = msg.match(/^XEM\s+NK\s*/);
  if (xemNk) {
    const rest = msg.slice(xemNk[0].length).trim();
    if (!rest || rest === 'HÔM NAY') return { intent: 'get_journal', data: { date: 'today' } };
    if (rest === 'HÔM QUA')          return { intent: 'get_journal', data: { date: 'yesterday' } };
    if (rest === 'NGÀY MAI')         return { intent: 'get_journal', data: { date: 'tomorrow' } };
    // XEM NK NGÀY DD/MM
    const ngay = rest.match(/^NG[ÀA]Y\s+(\d{1,2})[\/\-](\d{1,2})/);
    if (ngay) {
      const y = new Date().getFullYear();
      return { intent: 'get_journal', data: { date: `${y}-${ngay[2].padStart(2,'0')}-${ngay[1].padStart(2,'0')}` } };
    }
    // XEM NK THÁNG/TUẦN/NĂM → search_journal
    return { intent: 'search_journal', data: parsePeriodData(rest) };
  }

  // ── NK: TÌM nhật ký ──────────────────────────────────────
  const timNk = msg.match(/^T[ÌI]M\s+NK\s*/);
  if (timNk) {
    const rest = msg.slice(timNk[0].length).trim();
    return { intent: 'search_journal', data: parseSearchJournalData(rest) };
  }

  // ── TL: XEM tài liệu ─────────────────────────────────────
  const xemTl = msg.match(/^XEM\s+TL\s*/);
  if (xemTl || /^DANH\s+S[ÁA]CH\s+TL/.test(msg)) {
    const rest = xemTl ? msg.slice(xemTl[0].length).trim() : '';
    if (!rest) return { intent: 'get_documents', data: {} };
    const category = mapCategory(rest);
    return { intent: 'get_documents', data: category ? { category } : {} };
  }

  // ── TL: TÌM tài liệu ─────────────────────────────────────
  const timTl = msg.match(/^T[ÌI]M\s+TL\s*/);
  if (timTl) {
    const rest = msg.slice(timTl[0].length).trim();
    const danhmuc = rest.match(/^DANH\s+M[ỤU]C\s+(.*)/);
    if (danhmuc) {
      return { intent: 'search_document', data: { category: mapCategory(danhmuc[1]) || danhmuc[1].toLowerCase() } };
    }
    return { intent: 'search_document', data: { keyword: rest.toLowerCase() } };
  }

  // ── TL: XÓA tài liệu ─────────────────────────────────────
  const xoaTl = msg.match(/^X[ÓO]A\s+TL\s*/);
  if (xoaTl) {
    return { intent: 'delete_document', data: { keyword: msg.slice(xoaTl[0].length).trim().toLowerCase() } };
  }

  // ── TL: LƯU tài liệu (prefix TL) ────────────────────────
  if (/^TL\s+/.test(msg)) {
    const content = msg.slice(3).trim();
    const urlMatch = content.match(/HTTPS?:\/\/[^\s]+/i);
    if (urlMatch) {
      const url = urlMatch[0].toLowerCase();
      const desc = content.replace(urlMatch[0], '').trim().toLowerCase();
      return { intent: 'create_document', data: { type: 'link', url, description: desc || url, category: 'link' } };
    }
    const category = mapCategory(content);
    const lower = content.toLowerCase();
    return { intent: 'create_document', data: { type: 'text', content: lower, description: lower, category: category || 'khác' } };
  }

  return null; // Để Gemini xử lý các trường hợp mơ hồ
}

// Phân tích chuỗi ngày
function parseDateStr(str) {
  str = str.trim();
  if (!str || str === 'HÔM NAY')   return 'today';
  if (str === 'HÔM QUA')           return 'yesterday';
  if (str === 'NGÀY MAI')          return 'tomorrow';
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const y = new Date().getFullYear();
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  return null;
}

// Phân tích khoảng thời gian (THÁNG/TUẦN/NĂM)
function parsePeriodData(rest) {
  const thangNam = rest.match(/TH[ÁA]NG\s+(\d{1,2})\s+N[ĂA]M\s+(\d{4})/);
  if (thangNam) return { month: parseInt(thangNam[1]), year: parseInt(thangNam[2]), period: 'month' };
  const thang = rest.match(/TH[ÁA]NG\s+(\d{1,2})/);
  if (thang) return { month: parseInt(thang[1]), period: 'month' };
  if (/TU[ẦA]N\s+N[ÀA]Y/.test(rest))         return { week: 'this', period: 'week' };
  if (/TU[ẦA]N\s+TR[ƯU][ỚO]C/.test(rest))    return { week: 'last', period: 'week' };
  if (/TU[ẦA]N\s+(SAU|T[ỚO]I)/.test(rest))   return { week: 'next', period: 'week' };
  const nam = rest.match(/N[ĂA]M\s+(\d{4})/);
  if (nam) return { year: parseInt(nam[1]), period: 'year' };
  if (/^H[ÔO]M\s+QUA$/.test(rest))  return { period: 'yesterday' };
  if (/^H[ÔO]M\s+NAY$/.test(rest))  return { period: 'today' };
  return {};
}

// Phân tích dữ liệu tìm kiếm NK (keyword + khoảng thời gian)
function parseSearchJournalData(rest) {
  const data = parsePeriodData(rest);
  const kw = rest
    .replace(/TH[ÁA]NG\s+\d{1,2}\s+N[ĂA]M\s+\d{4}/g, '')
    .replace(/TH[ÁA]NG\s+\d{1,2}/g, '')
    .replace(/TU[ẦA]N\s+(N[ÀA]Y|TR[ƯU][ỚO]C|SAU|T[ỚO]I)/g, '')
    .replace(/N[ĂA]M\s+\d{4}/g, '')
    .replace(/H[ÔO]M\s+(NAY|QUA)/g, '')
    .trim();
  if (kw) data.keyword = kw.toLowerCase();
  return data;
}

// Map tên danh mục TL
function mapCategory(text) {
  const u = text.toUpperCase();
  if (/GI[ÁA]O\s*[ÁA]N/.test(u))     return 'giáo_án';
  if (/B[ÁA]O\s*C[ÁA]O/.test(u))     return 'báo_cáo';
  if (/THAM\s*KH[ẢA]O/.test(u))       return 'tham_khảo';
  if (/H[ÌI]NH\s*[ẢA]NH|^[ẢA]NH/.test(u)) return 'hình_ảnh';
  if (/HTTPS?:|WWW\./.test(u))         return 'link';
  return null;
}

// ============================================================

/**
 * Gửi message đến Gemini và nhận kết quả JSON
 */
async function processMessage(userMessage) {
  // Xử lý trực tiếp nếu lệnh rõ ràng — không tốn API call
  const preResult = preProcess(userMessage);
  if (preResult) {
    console.log('[AI] Pre-processed:', preResult.intent);
    return preResult;
  }

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
