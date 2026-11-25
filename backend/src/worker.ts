import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const prisma = new PrismaClient();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

// Rate‑limit config
const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || '2000'); // 2 s default

// Slack webhook lookup helper
async function getSlackWebhook(userId: string): Promise<string | null> {
  const record = await prisma.slackIntegration.findFirst({ where: { userId } });
  return record?.webhookUrl ?? null;
}

// Simple Redis‑based hourly counter
async function canSend(sender: string): Promise<boolean> {
  const now = Date.now();
  const hourKey = `emailRate:${sender}:${Math.floor(now / 3600000)}`; // hour bucket
  const count = await connection.incr(hourKey);
  if (count === 1) {
    // set expiry to end of the hour
    await connection.pexpireat(hourKey, (Math.floor(now / 3600000) + 1) * 3600000);
  }
  return count <= MAX_EMAILS_PER_HOUR;
}

async function sendSlackAlert(webhook: string, sender: string) {
  try {
    await axios.post(webhook, { text: `⚠️ Sender *${sender}* hit the hourly email limit (${MAX_EMAILS_PER_HOUR}).` });
  } catch (e) {
    console.error('Slack notification failed', e);
  }
}

// Create Ethereal transporter (or use provided credentials)
async function createTransport() {
  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.ETHEREAL_USER, pass: process.env.ETHEREAL_PASS },
    });
  }
  // fallback: generate test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

const worker = new Worker(
  'emailQueue',
  async (job: Job) => {
    const { sender, subject, body, to } = job.data as any;

    // Idempotency check – ensure not already sent
    const existing = await prisma.emailJob.findUnique({ where: { id: job.id as string } });
    if (existing?.status === 'sent') {
      console.log(`Job ${job.id} already sent, skipping`);
      return;
    }

    const allowed = await canSend(sender);
    if (!allowed) {
      // Re‑schedule for next hour preserving order
      const delay = 60 * 60 * 1000; // 1 hour
      await job.moveToDelayed(Date.now() + delay);
      // Notify Slack if integration exists
      const webhook = await getSlackWebhook(sender);
      if (webhook) await sendSlackAlert(webhook, sender);
      console.log(`Rate limit exceeded for ${sender}, job delayed 1h`);
      return;
    }

    const transporter = await createTransport();
    const info = await transporter.sendMail({ from: sender, to, subject, html: body });
    console.log('Message sent: %s', info.messageId);
    // Update DB status
    await prisma.emailJob.update({
      where: { id: job.id as string },
      data: { status: 'sent', sentAt: new Date() },
    });
    // Optional: log preview URL for Ethereal
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    // Enforce minimum delay between job executions (BullMQ limiter)
    limiter: {
      max: 1,
      duration: MIN_DELAY_MS,
    },
  },
);

worker.on('error', (err) => {
  console.error('Worker error', err);
});

console.log('Email worker started');
