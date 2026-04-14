# 🤖 Bot AI Trợ Lý Cá Nhân

Telegram bot tích hợp AI Gemini 2.5 Flash, Firebase Firestore.
Hỗ trợ: ghi nhật ký, quản lý task, nhắc việc, lập kế hoạch.

---

## 📁 Cấu trúc thư mục

```
bot-ai-ca-nhan/
├── server.js                    # Entry point, Express + webhook
├── package.json
├── .env                         # Biến môi trường (tạo từ .env.example)
├── .env.example
├── firebase-service-account.json  # Credential Firebase (KHÔNG commit)
├── firebase-service-account.example.json
└── src/
    ├── telegramHandler.js       # Nhận/gửi message Telegram
    ├── aiProcessor.js           # Gọi Gemini API, parse intent
    ├── actionRouter.js          # Điều hướng theo intent
    ├── firebaseService.js       # Helper CRUD Firestore
    ├── scheduler.js             # Cron job gửi reminder
    └── services/
        ├── journalService.js    # Nhật ký
        ├── taskService.js       # Công việc
        ├── reminderService.js   # Nhắc việc
        └── planService.js       # Kế hoạch
```

---

## ⚙️ Cài đặt

### 1. Tạo Telegram Bot

1. Nhắn `@BotFather` trên Telegram
2. Gõ `/newbot` → đặt tên → lấy **Token**

### 2. Lấy Gemini API Key

1. Vào [Google AI Studio](https://aistudio.google.com/)
2. Tạo API key → copy

### 3. Cài đặt Firebase

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Tạo project → Firestore Database (chế độ production)
3. Project Settings → Service Accounts → **Generate new private key**
4. Lưu file JSON vào `firebase-service-account.json`
5. Tạo **Composite Index** cho collection `reminders`:
   - Collection ID: `reminders`
   - Fields: `status ASC`, `remindAt ASC`

### 4. Cài đặt local

```bash
# Clone / tạo thư mục
npm install

# Copy và điền thông tin
cp .env.example .env
# Sửa .env với các giá trị thực

# Copy service account
cp firebase-service-account.example.json firebase-service-account.json
# Thay nội dung bằng file thực từ Firebase Console

# Chạy local (cần ngrok để test webhook)
npm run dev
```

### 5. Test local với ngrok

```bash
# Cài ngrok: https://ngrok.com/
ngrok http 3000

# Copy URL ngrok (vd: https://abc123.ngrok.io)
# Set vào .env: WEBHOOK_URL=https://abc123.ngrok.io

# Restart server để đăng ký webhook mới
npm run dev
```

---

## 🚀 Deploy lên Render (Free)

1. Push code lên GitHub (KHÔNG commit `.env` và `firebase-service-account.json`)

2. Vào [render.com](https://render.com/) → New Web Service

3. Connect GitHub repo

4. Cài đặt:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

5. Thêm Environment Variables:
   ```
   TELEGRAM_BOT_TOKEN=xxx
   GEMINI_API_KEY=xxx
   WEBHOOK_URL=https://your-app.onrender.com
   FIREBASE_PROJECT_ID=xxx
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   TZ=Asia/Ho_Chi_Minh
   ```
   > `FIREBASE_SERVICE_ACCOUNT_JSON`: paste toàn bộ nội dung JSON service account (1 dòng)

6. Deploy → lấy URL → tự động đăng ký webhook

---

## 💬 Ví dụ dùng bot

| Bạn nói | Bot làm |
|---------|---------|
| `Hôm nay dạy mệt quá` | Ghi nhật ký |
| `Cần soạn giáo án cho ngày mai` | Tạo task deadline ngày mai |
| `3h chiều họp tổ nhớ nhắc tôi` | Đặt reminder 15:00 hôm nay |
| `Hôm nay cần làm gì?` | Tổng quan ngày |
| `Xem lại nhật ký hôm qua` | Hiển thị nhật ký ngày hôm qua |
| `Xong task soạn giáo án rồi` | Đánh dấu hoàn thành |
| `Task tuần này có gì?` | Danh sách task 7 ngày tới |
| `Tạo kế hoạch ôn thi cuối kỳ` | Tạo plan mới |

---

## 🔧 Firestore Index cần tạo

Vào Firebase Console → Firestore → Indexes → Add Index:

| Collection | Field 1 | Field 2 | Query scope |
|-----------|---------|---------|-------------|
| reminders | status (ASC) | remindAt (ASC) | Collection group |
| tasks | dueDate (ASC) | status (ASC) | Collection |

---

## 🐛 Xử lý lỗi thường gặp

**Webhook không nhận được message:**
- Kiểm tra WEBHOOK_URL đúng chưa
- Đảm bảo server public (không chạy local mà thiếu ngrok)

**Firebase lỗi permission:**
- Kiểm tra Firestore Rules (set `allow read, write: if true;` khi dev)
- Đảm bảo service account có quyền Firestore

**AI không parse được:**
- Gemini đôi khi trả markdown - đã có fallback parser
- Kiểm tra GEMINI_API_KEY còn hạn dùng
