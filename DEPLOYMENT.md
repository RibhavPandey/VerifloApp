# Deployment Guide - GitHub to Vercel & Railway

## 📁 Files to Upload to GitHub

### ✅ What to Include

**Frontend (Root Directory):**
```
moneyapp/
├── components/          ✅ ALL files
├── lib/                 ✅ ALL files  
├── backend/             ✅ Entire folder
├── App.tsx              ✅
├── index.tsx            ✅
├── index.html           ✅
├── package.json         ✅
├── package-lock.json    ✅
├── tsconfig.json        ✅
├── vite.config.ts       ✅
├── tailwind.config.js   ✅
├── postcss.config.js    ✅
├── globals.css          ✅
├── types.ts             ✅
├── metadata.json        ✅
├── README.md            ✅
├── .gitignore           ✅
└── BACKEND_SETUP.md     ✅ (optional - for reference)
```

**Backend (backend/ folder):**
```
backend/
├── src/                 ✅ ALL files
│   ├── index.ts
│   ├── routes/
│   ├── middleware/
│   └── utils/
├── package.json         ✅
├── tsconfig.json        ✅
├── .gitignore           ✅
├── .env.example         ✅
└── README.md            ✅ (optional)
```

### ❌ What to EXCLUDE (GitHub ignores these automatically)

**Never commit:**
- `.env` files (anywhere)
- `.env.local`
- `node_modules/` folders
- `dist/` folders
- `.DS_Store` (Mac)
- `*.log` files

## 🚀 Deployment Steps

### Step 1: Prepare GitHub Repository

1. **Initialize Git** (if not done):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. **Create GitHub repository**:
   - Go to github.com
   - Click "New Repository"
   - Name it (e.g., "excelai-pro")
   - **DON'T** initialize with README
   - Click "Create repository"

3. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy Backend to Railway

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select your repository**
5. **Configure**:
   - Root Directory: Select `backend` folder
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. **Add Environment Variables** (in Railway dashboard):
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3001
   NODE_ENV=production
   ```
7. **Get Backend URL**: Railway will give you a URL like `https://your-app.railway.app`

### Step 3: Deploy Frontend to Vercel

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login** with GitHub
3. **Import Project** → Select your repository
4. **Configure**:
   - Framework Preset: **Vite**
   - Root Directory: `.` (root)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Add Environment Variables** (in Vercel dashboard):
   ```
   VITE_API_URL=https://your-backend.railway.app
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
6. **Deploy**: Click "Deploy"
7. **Get Frontend URL**: Vercel gives you URL like `https://your-app.vercel.app`

### Step 4: Update Backend CORS

1. **Go back to Railway**
2. **Update Environment Variable**:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
3. **Redeploy** backend (Railway auto-deploys on env var change)

## 🔐 Environment Variables Summary

### Backend (Railway)
```env
GEMINI_API_KEY=your_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=documents
FRONTEND_URL=https://your-app.vercel.app
PORT=3001
NODE_ENV=production
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend.railway.app
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## ✅ Checklist Before Deploying

- [ ] All code pushed to GitHub
- [ ] `.env` files NOT in repository (check .gitignore)
- [ ] Backend environment variables set in Railway
- [ ] Frontend environment variables set in Vercel
- [ ] Backend URL added to frontend env vars
- [ ] Frontend URL added to backend CORS
- [ ] Test locally first (optional but recommended)

## 🐛 Troubleshooting

**Backend won't start:**
- Check Railway logs
- Verify all env vars are set
- Check PORT is set (Railway assigns it automatically, but PORT env var should still exist)

**CORS errors:**
- Make sure FRONTEND_URL in backend matches your Vercel URL exactly
- Check for trailing slashes
- Redeploy backend after changing FRONTEND_URL

**401 Unauthorized errors:**
- Make sure user is logged in (Supabase auth)
- Check Supabase RLS policies are set up
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct

## 📝 Notes

- **Backend folder**: Railway deploys from `backend/` subdirectory
- **Frontend root**: Vercel deploys from repository root
- **Auto-deploy**: Both platforms auto-deploy on git push
- **Custom domains**: Can add later in both platforms
- **Environment variables**: Must be set in platform dashboards, NOT in code


