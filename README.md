# 🎯 ARIA - Voice-Powered AI Assistant

Your intelligent voice assistant for task management with natural language processing.

## ✨ Features

- 🎤 Voice commands with speech recognition
- 🤖 AI-powered (Google Gemini)
- 📧 Email reminders (5-min alerts, morning/evening summaries)
- 🎨 Modern, aesthetic UI with soothing colors
- 🔐 Secure JWT authentication

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Setup Environment

Get your API keys:
- **Gemini AI**: https://aistudio.google.com/app/apikey
- **Resend Email**: https://resend.com/api-keys (Optional)

Update `backend/.env`:
```env
GEMINI_API_KEY=your-gemini-key
RESEND_API_KEY=your-resend-key
```

**Note:** App works without RESEND_API_KEY, but email reminders will be disabled.

### 3. Run

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open: http://localhost:3000

## 🎤 Voice Commands

```
"Remind me to buy groceries today at 6pm"
"What are my tasks today?"
"Mark buy groceries as complete"
"Delete the grocery task"
```

## 📧 Email Features (Optional)

- ⏰ **5-min advance reminders** - Before task due time
- 🌅 **Morning summary (8 AM)** - Daily task overview
- 🌙 **Evening report (8 PM)** - Completed vs pending

## 🛠️ Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4  
**Backend:** Node.js, Express, MongoDB Atlas  
**AI:** Google Gemini  
**Email:** Resend API

## 📄 License

MIT
