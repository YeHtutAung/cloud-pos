# Nightlife POS — Claude Code Project Guide

## Project Overview
A portable, lightweight POS system for nightlife entertainment venues in Myanmar.
Targets bars, clubs, lounges, and festivals. Uses MMQR (MyanmarPay) for QR payments.

## Tech Stack
- Frontend: React + Vite + Tailwind CSS + PWA (vite-plugin-pwa)
- Backend: Node.js + Express + Socket.io
- Database: PostgreSQL + Prisma ORM
- Hosting: Railway
- Payments: MMQR (MyanmarPay) — Dynamic QR + webhook confirmation
- Notifications: Telegram Bot (Telegraf.js) — end-of-night PDF report
- State: Zustand
- Real-time: socket.io-client (frontend) + socket.io (backend)

## Architecture
- Monorepo: /frontend and /backend
- Single React app with role-based views (PIN login → staff | supervisor | owner)
- REST API for CRUD operations
- WebSocket for live order/table status updates
- Cron jobs for QR expiry and unpaid order alerts
- SOLID principles throughout — no hardcoded ENUMs, lookup tables for roles/statuses/types

## Key Design Decisions
- All statuses (order, table, shift, payment) live in a `statuses` table
- Roles live in a `roles` table with JSONB permissions
- Payment gateways in `payment_gateways` table — pluggable (MMQR first, Stripe later)
- Notification channels in `venue_notification_channels` — pluggable (Telegram first)
- Menu items have separate `menu_item_prices` table (supports happy hour, VIP pricing)
- Full `audit_logs` table for all critical actions

## Database
- PostgreSQL via Prisma ORM
- Schema at: backend/prisma/schema.prisma
- Seed file at: backend/prisma/seed.js (lookup tables pre-populated)

## Commands
- Dev: npm run dev (from root — runs both frontend and backend)
- DB migrate: npm run db:migrate
- DB seed: npm run db:seed
- DB studio: npm run db:studio

## Environment
- Backend .env.example at: backend/.env.example
- Copy to backend/.env and fill in values before running

## Current Status
- [x] Project scaffolded
- [x] Database schema designed (SOLID)
- [x] Frontend boilerplate (App.jsx, router, stores, services)
- [ ] Backend routes (auth, orders, payments, shifts, reports)
- [ ] Frontend UI (PIN login, staff order grid, supervisor dashboard, owner app)
- [ ] MMQR integration
- [ ] Telegram bot integration

## Build Order (follow this sequence)
1. Backend auth (PIN login + JWT)
2. Backend venue + zone + table routes
3. Backend menu routes (with CSV import)
4. Backend shift routes
5. Backend order routes + QR generation
6. Backend payment webhook (MMQR)
7. Frontend PIN login screen
8. Frontend staff order entry grid
9. Frontend supervisor live dashboard
10. Frontend owner setup + reports
11. MMQR full integration
12. Telegram bot + PDF report

## Code Style
- Use async/await (no callbacks)
- Always validate with express-validator
- Always log with Winston logger (src/utils/logger.js)
- Always write audit logs for critical actions (order void, shift close, menu import)
- Controllers stay thin — business logic in services/
- Emit WebSocket events after every state change
