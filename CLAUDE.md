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
- Single React app with role-based views (PIN login → staff | supervisor | owner | kitchen)
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
- Test: npm test (from backend/ — runs Jest suite)
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
- [x] Backend routes (auth, orders, payments, shifts, reports, menu, staff, venues, zones, tables)
- [x] Frontend UI (PIN login, staff order grid, supervisor dashboard, owner setup + reports)
- [x] MMQR integration (dynamic QR + ABank callback + dev stub fallback)
- [x] Telegram bot integration (PDF shift reports via Telegraf.js)
- [x] Kitchen Display System — confirm/ready order flow, kitchen role (PIN 333333)
- [x] SOLID compliance audit + audit log + WebSocket event fixes
- [x] Automated e2e test suite (Jest + supertest, 12 tests)

## Build Order (completed May 14–18 2026)
1. [x] Backend auth (PIN login + JWT)
2. [x] Backend venue + zone + table routes
3. [x] Backend menu routes (with CSV import)
4. [x] Backend shift routes
5. [x] Backend order routes + QR generation
6. [x] Backend payment webhook (MMQR)
7. [x] Frontend PIN login screen
8. [x] Frontend staff order entry grid
9. [x] Frontend supervisor live dashboard
10. [x] Frontend owner setup + reports
11. [x] MMQR full integration
12. [x] Telegram bot + PDF report
13. [x] Kitchen Display System (KDS) — beyond original scope

## Session Rules

### Autonomy & Approval
- Proceed with all tool use (file edits, shell commands, agent spawns) without pausing for confirmation during implementation tasks
- Only stop if genuinely blocked by a technical issue — never pause to ask "should I continue?"
- Full access is granted for the duration of every session

### Workflow Habits
- Run `npm test` (from `backend/`) before claiming any backend task is done
- Always update CLAUDE.md Current Status when a significant feature lands
- After fixing a bug, check whether a test should cover it and add one if not already present

### Code Conventions (reminders)
- Every critical action (order void, shift close, menu import, payment confirm/fail) must write an `audit_logs` entry
- Every state change must emit a WebSocket event via `getIo().to('venue:<id>').emit(...)`
- Controllers stay thin — no business logic; all logic lives in `services/`
- Validate all request input with `express-validator`; log errors with Winston (`src/utils/logger.js`)

### Branch & Git Discipline
- All work happens on the `dev` branch — never commit directly to `master`
- Merge to `master` only via PR after tests pass
- Commit messages follow the pattern: `<Verb> <what>` (e.g. `Add`, `Fix`, `Refactor`) — no ticket numbers required

## Code Style
- Use async/await (no callbacks)
- Always validate with express-validator
- Always log with Winston logger (src/utils/logger.js)
- Always write audit logs for critical actions (order void, shift close, menu import)
- Controllers stay thin — business logic in services/
- Emit WebSocket events after every state change
