import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { emailQueue } from './queue';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Bull‑Board UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
const { addQueue, removeQueue, setQueues } = createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Schedule email endpoint
app.post('/api/schedule', async (req, res) => {
  const { sender, subject, body, to, scheduleTime } = req.body;
  if (!sender || !subject || !body || !to || !scheduleTime) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const delay = Math.max(0, new Date(scheduleTime).getTime() - Date.now());
  const job = await emailQueue.add('sendEmail', { sender, subject, body, to }, { delay, attempts: 3 });
  await prisma.emailJob.create({
    data: {
      id: job.id as string,
      sender,
      subject,
      body,
      to,
      scheduledAt: new Date(scheduleTime),
      status: 'scheduled',
    },
  });
  res.json({ jobId: job.id });
});

// List scheduled emails
app.get('/api/scheduled', async (_req, res) => {
  const jobs = await prisma.emailJob.findMany({ where: { status: 'scheduled' } });
  res.json(jobs);
});

// List sent emails
app.get('/api/sent', async (_req, res) => {
  const jobs = await prisma.emailJob.findMany({ where: { status: 'sent' } });
  res.json(jobs);
});

// Slack integration – store webhook per user/sender
app.post('/api/slack/connect', async (req, res) => {
  const { userId, webhookUrl } = req.body;
  if (!userId || !webhookUrl) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  await prisma.slackIntegration.upsert({
    where: { userId },
    update: { webhookUrl },
    create: { userId, webhookUrl },
  });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
