# Veriflo

Invoice extraction, workflow automation, and AI chat—all in one workspace. Extract from PDFs, review risky fields, export to Tally/QuickBooks/Zoho.

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Gemini API key (for extraction)
- Razorpay account (for payments)

### Local Development

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Frontend - create .env in root
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend - create backend/.env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=http://localhost:5173
PORT=3001

# Run backend (terminal 1)
cd backend && npm run dev

# Run frontend (terminal 2)
npm run dev
```

Open http://localhost:5173

### Build & Test

```bash
npm run build    # Production build
npm run test     # Run tests
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Railway setup.

**Summary:** Push to GitHub → Deploy backend to Railway → Deploy frontend to Vercel → Set env vars in both dashboards.

## Project Structure

```
├── components/     # React components
├── lib/            # API, db, utils
├── backend/        # Express API (extract, enrich, chat, payment)
├── App.tsx         # Routes
└── types.ts        # Shared types
```

## Environment Variables

| Variable | Where | Required |
|----------|-------|----------|
| VITE_API_URL | Frontend | Yes |
| VITE_SUPABASE_URL | Frontend | Yes |
| VITE_SUPABASE_ANON_KEY | Frontend | Yes |
| GEMINI_API_KEY | Backend | Yes |
| SUPABASE_* | Backend | Yes |
| FRONTEND_URL | Backend | Yes (CORS) |
| RAZORPAY_* | Backend | For payments |

## What You Need To Do (Manual Steps)

### Before First Deploy
1. **Supabase**: Create project → Run SQL from `supabase_setup.sql` (or migrations) → Get URL + keys
2. **Gemini API**: Get key from Google AI Studio
3. **Razorpay**: Create account → Get Key ID + Secret (for payments)
4. **ZeptoMail/Zoho**: For welcome emails (optional but recommended)

### For Each Deploy
1. **Railway**: Set all backend env vars (see DEPLOYMENT.md)
2. **Vercel**: Set VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
3. **CORS**: Ensure FRONTEND_URL in backend matches your Vercel URL exactly

### After Deploy
1. **Supabase Auth**: Add your production URL to Redirect URLs
2. **Razorpay**: Add webhook URL if using webhooks
3. **Custom domain**: Add to Vercel + update FRONTEND_URL in Railway

## License

Private / Proprietary
