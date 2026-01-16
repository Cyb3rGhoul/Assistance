# 🚀 Deployment Guide - ARIA Assistant

This guide will help you deploy ARIA Assistant to production.

## 📋 Prerequisites

1. GitHub account
2. Render account (free tier available) - https://render.com
3. Vercel account (free tier available) - https://vercel.com
4. MongoDB Atlas account (free tier available) - https://www.mongodb.com/cloud/atlas

---

## Step 1: Push Code to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Create a new repository (e.g., `aria-assistant`)
   - Don't initialize with README

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/aria-assistant.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Deploy Backend to Render

### 2.1 Create Render Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository

### 2.2 Configure Backend

**Settings:**
- **Name:** `aria-backend`
- **Root Directory:** `backend`
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### 2.3 Add Environment Variables

In Render dashboard, go to **Environment** tab and add:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=your-random-secret-key-min-32-chars
GEMINI_API_KEY=your-gemini-api-key
EMAIL_USER=your-email-service-username
EMAIL_PASS=your-email-service-password
EMAIL_PROVIDER=brevo
RECIPIENT_EMAIL=cyber.ghoul019@gmail.com
FRONTEND_URL=https://your-vercel-app.vercel.app
```

**Important:**
- Generate a strong `JWT_SECRET` (random string, 32+ characters)
- Get MongoDB URI from MongoDB Atlas
- Get Gemini API key from https://aistudio.google.com/apikey
- Use Brevo or another email service (see EMAIL_SETUP.md)

### 2.4 Deploy

Click **"Create Web Service"** and wait for deployment.

**Note your backend URL:** `https://aria-backend.onrender.com` (or similar)

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Import Project

1. Go to https://vercel.com
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository

### 3.2 Configure Frontend

**Settings:**
- **Framework Preset:** Next.js
- **Root Directory:** `frontend` ⚠️ **CRITICAL - Must set this!**
- **Install Command:** `npm install` (auto, but verify it's NOT `cd frontend && npm install`)
- **Build Command:** `npm run build` (auto-detected)
- **Output Directory:** `.next` (auto-detected)

**⚠️ Important:** Once Root Directory is set to `frontend`, all commands run from that directory. So:
- ✅ Install Command: `npm install` (correct)
- ❌ Install Command: `cd frontend && npm install` (wrong - will fail)

### 3.3 Add Environment Variables

In Vercel dashboard, go to **Environment Variables** and add:

```env
NEXT_PUBLIC_API_URL=https://aria-backend.onrender.com
```

**Important:** Replace with your actual Render backend URL!

### 3.4 Deploy

Click **"Deploy"** and wait for deployment.

**Note your frontend URL:** `https://aria-assistant.vercel.app` (or similar)

---

## Step 4: Update Backend CORS

After getting your Vercel URL, update the backend environment variable in Render:

1. Go to Render dashboard → Your backend service
2. Go to **Environment** tab
3. Update `FRONTEND_URL` to your Vercel URL:
   ```env
   FRONTEND_URL=https://aria-assistant.vercel.app
   ```
4. Render will automatically redeploy

---

## Step 5: Test Deployment

1. Visit your Vercel frontend URL
2. Try to register/login
3. Test voice commands
4. Check if emails are being sent

---

## 🔧 Troubleshooting

### Backend Issues

**"Cannot connect to MongoDB"**
- Check MongoDB Atlas connection string
- Make sure IP is whitelisted (0.0.0.0/0 for Render)
- Check MongoDB Atlas network access settings

**"Port already in use"**
- Render uses PORT environment variable automatically
- Make sure you're using `process.env.PORT || 5000` in server.js

**"Environment variable not found"**
- Double-check all env vars are set in Render dashboard
- Restart the service after adding new variables

### Frontend Issues

**"Cannot connect to backend"**
- Check `NEXT_PUBLIC_API_URL` in Vercel
- Make sure backend URL is correct (no trailing slash)
- Check CORS settings in backend

**"Build failed"**
- Check build logs in Vercel
- Make sure all dependencies are in package.json
- Check for TypeScript errors

---

## 📝 Environment Variables Summary

### Backend (Render)
- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `GEMINI_API_KEY=...`
- `EMAIL_USER=...`
- `EMAIL_PASS=...`
- `EMAIL_PROVIDER=brevo`
- `RECIPIENT_EMAIL=cyber.ghoul019@gmail.com`
- `FRONTEND_URL=https://your-vercel-app.vercel.app`

### Frontend (Vercel)
- `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

---

## 🎉 You're Done!

Your ARIA Assistant is now live! Share your Vercel URL with others.

**Next Steps:**
- Set up custom domain (optional)
- Enable monitoring/logging
- Set up CI/CD for automatic deployments

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)
