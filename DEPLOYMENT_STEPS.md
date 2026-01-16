# 🚀 Quick Deployment Steps

## ✅ Pre-Deployment Checklist

- [x] Frontend builds successfully (`npm run build` in frontend/)
- [x] All hardcoded localhost URLs replaced with environment variables
- [x] Unwanted files deleted
- [x] Deployment configs created

---

## Step-by-Step Deployment

### 1️⃣ Push to GitHub

```bash
# Initialize git (if not done)
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/aria-assistant.git
git branch -M main
git push -u origin main
```

### 2️⃣ Deploy Backend to Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub → Select your repo
4. Configure:
   - **Name:** `aria-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=your-mongodb-uri
   JWT_SECRET=your-secret-key-32-chars-min
   GEMINI_API_KEY=your-api-key
   EMAIL_USER=your-email-username
   EMAIL_PASS=your-email-password
   EMAIL_PROVIDER=brevo
   RECIPIENT_EMAIL=cyber.ghoul019@gmail.com
   FRONTEND_URL=https://your-vercel-url.vercel.app
   ```
6. Click **"Create Web Service"**
7. **Copy your backend URL** (e.g., `https://aria-backend.onrender.com`)

### 3️⃣ Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto)
   - **Output Directory:** `.next` (auto)
5. Add Environment Variable:
   ```
   NEXT_PUBLIC_API_URL=https://aria-backend.onrender.com
   ```
   (Use your actual Render backend URL!)
6. Click **"Deploy"**
7. **Copy your frontend URL** (e.g., `https://aria-assistant.vercel.app`)

### 4️⃣ Update Backend CORS

1. Go back to Render dashboard
2. Update `FRONTEND_URL` environment variable with your Vercel URL
3. Render will auto-redeploy

### 5️⃣ Test!

1. Visit your Vercel URL
2. Register/Login
3. Test voice commands
4. Check email delivery

---

## 🔑 Environment Variables Reference

### Backend (Render)
```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-random-secret-32-chars-minimum
GEMINI_API_KEY=AIza...
EMAIL_USER=your-email-service-username
EMAIL_PASS=your-email-service-password
EMAIL_PROVIDER=brevo
RECIPIENT_EMAIL=cyber.ghoul019@gmail.com
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## 🎉 Done!

Your app is now live! Share your Vercel URL.

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
