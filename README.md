# 🤖 Bot AI Trợ Lý Cá Nhân

Telegram bot tích hợp AI Gemini 2.5 Flash, Firebase Firestore.

---

## ✨ Chức năng

| Chức năng | Lệnh ví dụ |
|---|---|
| **📔 NHẬT KÝ** | |
| Ghi nhật ký | `Hôm nay dạy mệt quá` |
| Xem nhật ký | `Xem lại nhật ký hôm qua` |
| Sửa nhật ký | `Sửa nhật ký hôm nay thành hôm nay đi họp mệt quá` |
| Xóa nhật ký | `Xóa nhật ký hôm qua` |
| **📋 CÔNG VIỆC (TASK)** | |
| Tạo task | `Cần soạn giáo án cho ngày mai` |
| Tạo task kèm giờ | `3h chiều soạn giáo án` _(tự đặt reminder)_ |
| Sửa task | `Đổi task soạn giáo án thành soạn bài kiểm tra` |
| Xóa task | `Xóa task soạn giáo án` |
| Hoàn thành task | `Xong task soạn giáo án rồi` |
| Xem task hôm nay | `Hôm nay cần làm gì?` |
| Xem task tuần này | `Task tuần này có gì?` |
| **🔔 NHẮC VIỆC (REMINDER)** | |
| Tạo nhắc việc | `3h chiều họp tổ nhớ nhắc tôi` |
| Tạo nhắc việc ngày mai | `Mai 8h nhắc nộp báo cáo` |
| Sửa giờ nhắc | `Đổi nhắc sạc xe sang 14h` |
| Sửa nội dung nhắc | `Sửa nhắc sạc xe thành sạc máy tính` |
| Xóa nhắc việc | `Xóa nhắc việc sạc xe điện` |
| Hoàn thành nhắc việc | `Xác nhận đã hoàn thành sạc xe điện` |
| Xem danh sách | `Xem danh sách nhắc việc` |
| **📅 LỊCH CÔNG TÁC** | |
| Nhập lịch cả tuần | `Lịch công tác tuần tới: Thứ 2: họp hội đồng 7h30, Thứ 5: kiểm tra 1 tiết` |
| Thêm 1 việc | `Thêm vào lịch thứ 4 tuần tới họp phụ huynh 18h` |
| Sửa lịch | `Sửa lịch họp hội đồng thành 8h` |
| Xóa lịch | `Xóa lịch dạy bù thứ 3` |
| Hoàn thành lịch | `Xong việc họp hội đồng rồi` |
| Xem lịch hôm nay | `Xem lịch hôm nay` |
| Xem lịch ngày mai | `Xem lịch ngày mai` |
| Xem lịch tuần này | `Xem lịch tuần này` |
| Xem lịch tuần tới | `Xem lịch tuần tới` |
| **📊 TỔNG QUAN** | |
| Tổng quan hôm nay | `Hôm nay tôi có gì?` _(lịch + task + nhắc việc)_ |
| Tổng quan ngày mai | `Ngày mai tôi có gì?` |
| Tổng quan tuần này | `Tuần này tôi có gì?` |
| **📌 KẾ HOẠCH** | |
| Tạo kế hoạch | `Tạo kế hoạch ôn thi cuối kỳ` |
| Xem kế hoạch | `Xem kế hoạch` |
| Xóa kế hoạch | `Xóa kế hoạch ôn thi cuối kỳ` |

---

## 📁 Cấu trúc thư mục

```
tro-ly-ai/
├── server.js                    # Entry point, Express + webhook
├── package.json
├── .env                         # Biến môi trường (tạo từ .env.example)
├── .env.example
├── firebase-service-account.json  # Credential Firebase (KHÔNG commit)
└── src/
    ├── telegramHandler.js       # Nhận/gửi message Telegram
    ├── aiProcessor.js           # Gọi Gemini API, parse intent
    ├── actionRouter.js          # Điều hướng theo intent
    ├── firebaseService.js       # Helper CRUD Firestore
    ├── scheduler.js             # Cron job gửi reminder mỗi phút
    └── services/
        ├── journalService.js    # Nhật ký
        ├── taskService.js       # Công việc
        ├── reminderService.js   # Nhắc việc
        ├── scheduleService.js   # Lịch công tác
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

### 4. Cài đặt local

```bash
npm install

cp .env.example .env
# Sửa .env với các giá trị thực

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

2. Vào [render.com](https://render.com/) → New Web Service → Connect GitHub repo

3. Cài đặt:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

4. Thêm Environment Variables:
   ```
   TELEGRAM_BOT_TOKEN=xxx
   GEMINI_API_KEY=xxx
   WEBHOOK_URL=https://your-app.onrender.com
   FIREBASE_PROJECT_ID=xxx
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   TZ=Asia/Ho_Chi_Minh
   ```
   > `FIREBASE_SERVICE_ACCOUNT_JSON`: paste toàn bộ nội dung JSON service account (1 dòng)

5. Deploy → lấy URL → tự động đăng ký webhook

6. Dùng [UptimeRobot](https://uptimerobot.com) ping URL mỗi 5 phút để Render không ngủ

---

## 🔧 Firestore Index cần tạo

Vào Firebase Console → Firestore → Indexes → Add Index:

| Collection | Fields | Query scope |
|---|---|---|
| `reminders` | `status` ASC + `remindAt` ASC | Collection group |
| `reminders` | `reminderSent` ASC + `remindAt` ASC | Collection group |
| `schedule` | `reminderSent` ASC + `remindAt` ASC | Collection group |

---

## 🐛 Xử lý lỗi thường gặp

**Bot không phản hồi:**
- Render free tier tự ngủ sau 15 phút — dùng UptimeRobot để giữ server luôn chạy

**Reminder không gửi đúng giờ:**
- Kiểm tra Firestore Indexes đã tạo đủ và status là Enabled chưa

**Webhook không nhận được message:**
- Kiểm tra `WEBHOOK_URL` đúng chưa
- Đảm bảo server public (không chạy local mà thiếu ngrok)

**Firebase lỗi permission:**
- Kiểm tra Firestore Rules (set `allow read, write: if true;` khi dev)
- Đảm bảo service account có quyền Firestore

**AI không parse được:**
- Gemini đôi khi trả markdown — đã có fallback parser
- Kiểm tra `GEMINI_API_KEY` còn hạn dùng
