# 🎯 ARIA - Voice-Powered AI Assistant

Your intelligent voice assistant for task management with natural language processing.

## ✨ Features

- 🎤 Voice commands with speech recognition
- 🤖 AI-powered (Google Gemini)
- 📧 Email reminders (5-min alerts, morning/evening summaries)
- 📱 WhatsApp reminders with interactive commands (DONE, RESCHEDULE, DISMISS)
- 🔗 Link management with voice commands
- 🎨 Modern, aesthetic UI with soothing colors
- 🔐 Secure JWT authentication with Google OAuth
- 📱 Mobile-responsive design

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
- **Gemini AI**: https://aistudio.google.com/app/apikey (Required)
- **Resend Email**: https://resend.com/api-keys (Optional)
- **Whatabot WhatsApp**: https://whatabot.net/ (Optional)

Update `backend/.env`:
```env
GEMINI_API_KEY=your-gemini-key
RESEND_API_KEY=your-resend-key
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
FRONTEND_URL=http://localhost:3000
```

**Note:** App works with just GEMINI_API_KEY. Other services are optional but enhance functionality.

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
"Add link to YouTube called entertainment"
"Show me my links"
"Delete the YouTube link"
```

## 📧 Email Features (Optional)

- ⏰ **5-min advance reminders** - Before task due time
- 🌅 **Morning summary (8 AM)** - Daily task overview
- 🌙 **Evening report (8 PM)** - Completed vs pending

## 📱 WhatsApp Features (Optional)

- 🔔 **Task reminders** - Sent via WhatsApp
- 🌅 **Morning/evening summaries** - Daily reports via WhatsApp
- 📱 **One-way notifications** - Receive reminders and updates

## 🛠️ Tech Stack

**Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS  
**Backend:** Node.js, Express, MongoDB Atlas  
**AI:** Google Gemini  
**Email:** Resend API  
**WhatsApp:** Whatabot API  
**Auth:** JWT + Google OAuth

## 📄 License

MIT
