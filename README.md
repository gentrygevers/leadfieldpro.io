# LeadField Pro

LSA (Google Local Service Ads) gap intelligence platform for local marketing agencies.

Finds blue collar businesses not running LSA, calculates their missed revenue, scrapes their email, and lets you send one-click personalized pitch emails via Gmail.

## Features

- **Lead Search** — Google Places API, filters chains >800 reviews, auto-saves to CRM
- **Email Finder** — scrapes business website → Facebook About → pattern fallback (no third-party APIs)
- **CRM Pipeline** — New → Researching → Contacted → Replied → Qualified → Closed
- **One-Click Gmail Pitch** — personalized email with real missed revenue numbers
- **Public ROI Calculator** — standalone page at `/lsa-calculator.html`
- **Dashboard** — stats, pipeline breakdown, recent search history

## Stack

- Frontend: React + Vite → Vercel
- Backend: Node/Express → Railway
- Storage: In-memory (ready for Supabase swap)

## Local Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Add your GOOGLE_PLACES_API_KEY to .env
node src/index.js
# Runs on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3001/api for local dev
npm run dev
# Runs on http://localhost:5173
```

## Deployment

### Frontend → Vercel

1. Import `frontend/` directory in Vercel
2. Set env vars:
   - `VITE_API_URL` = your Railway backend URL + `/api`
   - `VITE_CALCULATOR_URL` = your Vercel URL + `/lsa-calculator.html`
3. Build command: `npm run build`, Output: `dist/`

### Backend → Railway

1. Import `backend/` directory in Railway
2. Set env vars:
   - `GOOGLE_PLACES_API_KEY` = your key
   - `FRONTEND_URL` = your Vercel URL
   - `PORT` = `3001`
3. Start command: `node src/index.js`

## Industry Benchmarks

| Vertical    | Calls/mo | Close Rate | Avg Ticket | Answer Rate |
|-------------|----------|------------|------------|-------------|
| HVAC        | 28       | 42%        | $485       | 78%         |
| Plumbing    | 22       | 55%        | $310       | 80%         |
| Electrical  | 18       | 48%        | $420       | 75%         |
| Roofing     | 12       | 35%        | $8,500     | 70%         |
| Landscaping | 35       | 60%        | $280       | 82%         |

## Supabase Migration

The in-memory store in `backend/src/services/store.js` is designed for a clean swap:
- Replace `store.leads` array operations with Supabase client calls
- Same interface, just different persistence layer
