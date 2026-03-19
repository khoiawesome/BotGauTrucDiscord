# 🦊 GauTruc — Discord Voice AFK Bot

Bot Discord vào voice channel và treo ở đó (tắt tiếng) để câu thời gian call.

## 📋 Hướng dẫn Setup Discord Developer Portal

### Bước 1: Tạo Application

1. Vào **[Discord Developer Portal](https://discord.com/developers/applications)**
2. Nhấn nút **"New Application"** (góc trên phải)
3. Đặt tên: `GauTruc` → nhấn **Create**

### Bước 2: Tạo Bot

1. Ở menu bên trái, chọn tab **"Bot"**
2. Nhấn **"Reset Token"** → xác nhận → **copy Token** (lưu lại, chỉ hiện 1 lần!)
3. Kéo xuống phần **Privileged Gateway Intents**:
   - ✅ Bật **SERVER MEMBERS INTENT**
   - ✅ Bật **VOICE STATE INTENT** *(bắt buộc để bot biết ai ở voice)*

### Bước 3: Lấy Application ID

1. Ở menu bên trái, chọn tab **"General Information"**
2. Copy **Application ID** (đây là `CLIENT_ID`)

### Bước 4: Lấy Guild (Server) ID

1. Mở Discord app → vào **User Settings** → **Advanced** → bật **Developer Mode**
2. Chuột phải vào tên server → **Copy Server ID** (đây là `GUILD_ID`)

### Bước 5: Invite Bot vào Server

1. Ở Developer Portal, chọn tab **"OAuth2"** → **"URL Generator"**
2. Tick các **Scopes**:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Tick các **Bot Permissions**:
   - ✅ `Connect` (vào voice channel)
   - ✅ `Speak` (cần để Discord cho phép kết nối voice)
4. Copy **Generated URL** ở dưới cùng → mở link trong trình duyệt
5. Chọn server → **Authorize**

## 🚀 Cài đặt & Chạy Bot

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo file `.env`

Copy file `.env.example` thành `.env` và điền thông tin:

```bash
copy .env.example .env
```

Sau đó mở `.env` và thay thế:
- `your_bot_token_here` → Token bot (Bước 2)
- `your_client_id_here` → Application ID (Bước 3)
- `your_guild_id_here` → Server ID (Bước 4)

### 3. Đăng ký Slash Commands

```bash
npm run deploy
```

### 4. Chạy bot

```bash
npm start
```

Khi thấy `✅ GauTruc đã online!` là bot đã sẵn sàng!

## 🎮 Cách sử dụng

| Command    | Mô tả                                                |
| ---------- | ----------------------------------------------------- |
| `/join`    | Bot vào voice channel bạn đang ở, tự mute & deafen   |
| `/leave`   | Bot rời voice channel, hiện tổng thời gian đã treo    |
| `/status`  | Xem bot đang ở channel nào và thời gian đã treo       |

## ⚠️ Lưu ý

- Bạn **phải ở trong voice channel** trước khi gõ `/join`
- Bot tự **mute + deafen** nên không nghe/nói gì cả
- Bot tự **reconnect** nếu bị disconnect tạm thời
- Để bot chạy liên tục, bạn cần giữ terminal mở (hoặc dùng `pm2`, `screen`, v.v.)
