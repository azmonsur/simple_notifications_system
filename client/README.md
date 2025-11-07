# Notifications Dashboard - Production-ready

This is a TypeScript + React + Vite + Tailwind dashboard with:
- JWT auth (frontend)
- Charts (Chart.js)
- Dockerfile + Nginx config for production

## Setup (dev)
1. npm install
2. Create .env with `VITE_API_BASE=http://localhost:4000/api/v1/admin`
3. npm run dev

## Production build (Docker)
1. Build image: `docker build -t notifications-dashboard .`
2. Run (example): `docker run -p 80:80 --env API_URL=http://your-backend notifications-dashboard`

Note: nginx.conf proxies /api/ to a `backend` host. In production, set up proper backend host or modify nginx.conf.
