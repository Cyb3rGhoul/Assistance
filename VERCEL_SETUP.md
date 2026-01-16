# Vercel Deployment Configuration

## Important: Vercel Dashboard Settings

When deploying to Vercel, you **MUST** configure these settings in the Vercel dashboard:

### 1. Root Directory
- Go to your project settings in Vercel
- Navigate to **Settings** → **General**
- Find **Root Directory**
- Set it to: `frontend`
- Click **Save**

### 2. Environment Variables
- Go to **Settings** → **Environment Variables**
- Add:
  ```
  NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
  ```

### 3. Build Settings (Auto-detected if Root Directory is set)
- Framework Preset: Next.js (auto)
- Build Command: `npm run build` (auto)
- Output Directory: `.next` (auto)
- Install Command: `npm install` (auto)

## Why This is Needed

Vercel needs to know that your Next.js app is in the `frontend` subdirectory, not the root. Once you set the Root Directory to `frontend`, Vercel will:
- Look for `package.json` in the `frontend` folder
- Find Next.js automatically
- Run build commands from the `frontend` directory

## Alternative: Remove vercel.json

If you set Root Directory correctly in the dashboard, you can actually delete `vercel.json` and Vercel will auto-detect everything!
