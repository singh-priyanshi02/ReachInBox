# ReachInbox Email Scheduler

## Overview

A production‑grade email scheduler built with **Express + TypeScript**, **BullMQ + Redis**, **PostgreSQL**, **Ethereal Email** for testing, and a **Next.js + Tailwind** frontend.

The system supports:
- Scheduling emails for a specific future time.
- Persistent delayed jobs via BullMQ (no cron).
- Rate limiting (configurable hourly limit) with a minimum delay between sends.
- Slack notification when a sender hits its hourly limit.
- Google OAuth login (real) and Slack OAuth connection.
- Searchable email metadata in Elasticsearch.
- Live Bull‑Board UI for queue inspection.

## Repository Structure

```
ReachInbox/
├─ backend/               # Express API + BullMQ worker
│   ├─ src/
│   │   ├─ app.ts        # Express server & routes
│   │   ├─ worker.ts     # BullMQ worker implementation
│   │   ├─ prisma/
│   │   │   └─ schema.prisma
│   │   ├─ email/
│   │   │   └─ transporter.ts   # Nodemailer/Ethereal config
│   │   ├─ slack/
│   │   │   └─ notifier.ts      # Slack webhook helper
│   │   └─ utils/
│   │       └─ rateLimiter.ts   # Redis‑backed hourly counter
│   ├─ package.json
│   └─ tsconfig.json
├─ frontend/               # Next.js UI
│   ├─ pages/
│   │   ├─ _app.tsx
│   │   ├─ index.tsx      # Landing (redirect to /dashboard after login)
│   │   ├─ dashboard.tsx  # Main UI with tabs
│   │   └─ api/auth/[...nextauth].ts   # Next‑Auth Google provider
│   ├─ components/
│   │   ├─ Header.tsx
│   │   ├─ EmailTable.tsx
│   │   ├─ ComposeModal.tsx
│   │   └─ SlackConnectButton.tsx
│   ├─ styles/
│   │   └─ globals.css
│   ├─ tailwind.config.js
│   ├─ postcss.config.js
│   ├─ package.json
│   └─ tsconfig.json
├─ docker-compose.yml       # Services: redis, postgres, elasticsearch, backend, frontend
└─ .env.example             # Environment variable template
```

## Getting Started

### Prerequisites
- **Docker Desktop** (or Docker Engine) installed.
- **Node.js 20+** and **npm** (for local development).
- A Google Cloud project with OAuth consent screen set up.
- A Slack app with OAuth scopes `chat:write` and a **Incoming Webhook** URL.

### 1. Clone the repository

```bash
git clone https://github.com/singh-priyanshi02/ReachInBox.git
cd ReachInBox
```

### 2. Create a `.env` file
Copy the provided `.env.example` and fill in the real values you received (or keep the placeholders for local testing).

```bash
cp .env.example .env
```

Key variables:
- `POSTGRES_URL` – PostgreSQL connection string.
- `REDIS_URL` – Redis connection (default `redis://redis:6379`).
- `ELASTICSEARCH_URL` – URL for the Elasticsearch container.
- `ETHEREAL_USER` / `ETHEREAL_PASS` – Ethereal SMTP credentials.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – Google OAuth.
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` – Slack OAuth.
- `MAX_EMAILS_PER_HOUR` – Global rate‑limit (default `200`).
- `MIN_SEND_DELAY_MS` – Minimum delay between two sends (default `2000`).

### 3. Run everything with Docker Compose

```bash
docker compose up --build
```
This will start:
- **PostgreSQL** (`postgres` service)
- **Redis** (`redis` service)
- **Elasticsearch** (`elasticsearch` service)
- **backend** (API + BullMQ worker)
- **frontend** (Next.js dev server on `http://localhost:3000`)

### 4. Access the application
- Open `http://localhost:3000` → Sign in with Google.
- After login you land on the dashboard where you can:
  - **Compose** a new email (upload CSV of recipients, set start time, delay, hourly limit).
  - View **Scheduled** and **Sent** email tables.
  - Connect Slack via the *Connect Slack* button to receive rate‑limit alerts.

### 5. Bull‑Board (queue inspection)
Visit `http://localhost:3000/admin/queues` (protected by a simple bearer token set via `QUEUE_DASHBOARD_TOKEN` env var) to see live job statuses.

### 6. Demonstrating persistence & restart safety
1. Schedule a few emails with a future send time (e.g., 5 minutes ahead).
2. Stop the backend container:
   ```bash
   docker compose stop backend
   ```
3. Restart it:
   ```bash
   docker compose start backend
   ```
4. The pending jobs remain in Redis and are processed at the correct time – no duplicates.

### 7. Rate‑limit & Slack notification demo
- Set `MAX_EMAILS_PER_HOUR` low (e.g., `5`) in `.env`.
- Schedule >5 emails for the same hour.
- After the 5th email is sent, the worker will hit the limit, re‑queue remaining jobs for the next hour, and send a Slack message to the connected workspace (visible in the channel you chose during Slack OAuth).

## Architecture Details

### Scheduling Flow
1. **POST /api/schedule** receives email payload + CSV of recipients.
2. For each recipient a record is inserted into PostgreSQL (`EmailJob` table) with a UUID *jobId*.
3. A BullMQ delayed job is created with `delay = scheduledTime - now` and the same *jobId*.
4. The worker pulls jobs, checks the Redis hourly counter (`rateLimiter.checkAndIncrement(senderId)`).
   - If under the limit: send via Nodemailer → update DB status to `sent` → index document in Elasticsearch.
   - If limit reached: compute `nextHourStart`, re‑add the job with that delay, and trigger Slack notification.
5. Idempotency is ensured by checking the DB status before sending; duplicate processing is ignored.

### Rate Limiting Implementation
- **Redis hash**: `email_rate:{senderId}` where each field is an hour timestamp (e.g., `2023112514`).
- `INCRBY` atomically increments the count.
- The hash is TTL‑ed to 2 hours, so counters automatically expire.
- All workers share the same Redis instance, guaranteeing a distributed safe count.

### Slack Notification
- When a limit breach occurs, the worker posts to the stored webhook URL (`slack_webhook_{tenant}`) using a simple JSON payload.
- If the tenant hasn't connected Slack, the step is a no‑op.

### Search (Elasticsearch)
- After a successful send, the worker indexes a document with fields: `email`, `subject`, `body`, `sentAt`, `status`.
- A simple GET `/api/search?query=...` runs a `match` query against the `emails` index.

## Demo Video
Record a screen capture (max 5 min) showing:
1. Login via Google.
2. Compose & schedule a batch of emails.
3. View them in the *Scheduled* tab.
4. Stop the backend container, restart it, and confirm pending jobs still fire.
5. Trigger a rate‑limit breach (set low limit) and show the Slack message arriving.
6. Browse the Bull‑Board UI showing job lifecycle.

Upload the video to a shareable platform (e.g., Google Drive) and add the link to the repository's `README.md` under **Demo Video**.

## Assumptions & Trade‑offs
- **Ethereal** is used only for development/testing; swapping to a real SMTP service requires only changing the nodemailer transport.
- **Elasticsearch** is optional – if you prefer not to run it, you can comment out indexing calls; the rest of the system works without search.
- **Slack** integration uses Incoming Webhooks for simplicity. If you need full bot interaction, the notifier can be expanded.
- The UI mirrors the provided Figma design to the extent possible with Tailwind utilities; minor pixel differences may exist without the exact design assets.

## Access & Collaboration
- The repository **already exists** at the URL you supplied. Please grant me (the Antigravity agent) collaborator access so I can push the initial scaffold.
- Once I have write permissions, I will push the code described above. If you prefer I keep everything local, let me know and I will provide a zip of the workspace.

---

*Happy coding! 🚀*