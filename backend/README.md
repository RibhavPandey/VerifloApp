# Veriflo Backend API

Backend API server for Veriflo application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your Gemini API key to `.env`:
```
GEMINI_API_KEY=your_key_here
FRONTEND_URL=http://localhost:3000
PORT=3001
```

## Development

Run in development mode:
```bash
npm run dev
```

## Production

Build:
```bash
npm run build
```

Start:
```bash
npm start
```

## API Routes

- `POST /api/extract` - Document extraction
- `POST /api/enrich` - Data enrichment
- `POST /api/analyze` - Data analysis
- `POST /api/chat/stream` - Chat streaming
- `GET /health` - Health check
