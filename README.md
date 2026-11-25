# ReachInbox Email Scheduler

## Overview

A production‑grade email scheduling service built with **TypeScript**, **Express**, **BullMQ**, **Redis**, **PostgreSQL**, **Elasticsearch**, and a **Next.js** frontend.

- Schedule emails via a REST API or the UI.
- BullMQ handles delayed jobs – no cron.
- Rate limiting (configurable per hour) with Redis counters.
- Slack notifications when a sender hits its hourly limit.
- Searches scheduled/sent emails via Elasticsearch.
- Live BullMQ dashboard (`/admin/queues`).
- Google OAuth login for the UI.

## Quick Start (Docker)

```bash
# clone the repo (private – add your collaborators)
# cd ReachInbox
docker compose up -d   # starts redis, postgres, elasticsearch
# In two terminals:
# Backend
cd backend && npm install && npm run dev
# Frontend
cd ../frontend && npm install && npm run dev
```

## Environment Variables

Create a `.env` file in `backend/` (see `.env.example`). Key variables:

- `DATABASE_URL` – PostgreSQL connection string.
- `REDIS_URL` – Redis connection string.
- `ELASTICSEARCH_URL` – Elasticsearch endpoint.
- `ETHEREAL_USER` / `ETHEREAL_PASS` – generated from https://ethereal.email/create.
- `MAX_EMAILS_PER_HOUR` – default `200`.
- `MIN_DELAY_MS` – default `2000` (2 s) between sends.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – for NextAuth.
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` – for Slack OAuth.

## Architecture

```
Client (Next.js) <-> Backend (Express) <-> PostgreSQL
                               │
                               └─> Redis (BullMQ) ──> Worker (email sender)
                               │
                               └─> Elasticsearch (search index)
```

- **Persistence**: BullMQ stores delayed jobs in Redis, which survive restarts. Job status is persisted in PostgreSQL.
- **Rate limiting**: Redis counters keyed by `hour:{senderId}`; workers check before sending. If limit exceeded, the job is re‑scheduled for the next hour and a Slack message is queued.
- **Slack integration**: When a limit is hit, a notification job posts to the stored webhook URL.
- **Idempotency**: Before sending, the worker verifies the email hasn't already been marked `sent`.

## Scripts

- `backend/`
  - `npm run dev` – start Express with ts-node-dev.
  - `npm run build && npm start` – production run.
  - `npm run worker` – start BullMQ worker.
- `frontend/`
  - `npm run dev` – Next.js dev server.
  - `npm run build && npm start` – production.

## Demo Video

Record a short (<5 min) video covering:
1. Creating a scheduled email via the UI.
2. Viewing it in the Scheduled tab.
3. Restarting the backend (`docker compose restart backend`) and confirming the email still sends.
4. Hitting the hourly limit and showing the Slack notification.

## Assumptions & Trade‑offs

- Only one tenant is demonstrated; multi‑tenant support can be added by scoping DB rows and Redis keys.
- CSV parsing is performed client‑side for simplicity.
- Elasticsearch is optional for search; fallback to DB queries exists.
- Worker concurrency is set via `WORKER_CONCURRENCY` env var (default `5`).

---

Feel free to raise any questions or request additional functionality. If you need to modify the configuration, create a `.env` file in the `backend/` folder (see the example below).
