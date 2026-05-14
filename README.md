# Nightlife POS

Portable, lightweight Point-of-Sale system built for nightlife entertainment venues in Myanmar.

## Features

- **Fast Order Entry** — Grid-based drink buttons optimized for dark, noisy environments
- **MMQR Payments** — MyanmarPay QR self-pay (compatible with all Myanmar banks & wallets)
- **Real-time Updates** — WebSocket-powered live dashboard for supervisors
- **Role-based Access** — Owner / Supervisor / Staff with PIN login
- **Zone Management** — Bar, VIP, Rooftop, Stage — each with assigned staff
- **Multi-shift Support** — Happy Hour / Main Night / Late Night
- **Telegram Reports** — End-of-night summary + PDF sent automatically
- **SOLID Architecture** — Extensible for new payment gateways & notification channels

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS + PWA |
| State | Zustand |
| Real-time | Socket.io |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Hosting | Railway |
| Payments | MMQR (MyanmarPay) |
| Notifications | Telegram Bot (Telegraf.js) |
| PDF Reports | Puppeteer |
| QR Expiry | node-cron |

---

## Getting Started

### 1. Install
```bash
npm run install:all
```

### 2. Environment
```bash
cd backend && cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, MMQR credentials, TELEGRAM_BOT_TOKEN
```

### 3. Database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Run
```bash
npm run dev
```

Frontend → http://localhost:3000
Backend  → http://localhost:5000
Prisma Studio → `npm run db:studio`

---

## Database Design

All statuses, roles, venue types, and report types are lookup tables — add new values by inserting a row, never by altering schema. Payment gateways and notification channels are pluggable via dedicated tables. Full audit log on all critical actions.
