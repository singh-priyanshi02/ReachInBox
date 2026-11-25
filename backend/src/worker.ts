import { Worker, Queue, FlowProducer } from 'bullmq';
import { prisma, emailQueue } from './app';
import { createTransport } from 'nodemailer';
import { sendSlackAlert } from '../slack/notifier';
import { acquireRateSlot } from '../utils/rateLimiter';
import dotenv from 'dotenv';

dotenv.config();

const connection = emailQueue.client;

// Email transporter (Ethereal)
const transporter = createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASS,
  },
});

// Worker processing function
type EmailJobData = {
  jobId: string;
  to: string;
  subject: string;
  html: string;
  senderId: string; // could be tenant or user identifier
};

const emailWorker = new Worker<EmailJobData>('emailQueue', async job => {
  const { jobId, to, subject, html, senderId } = job.data;

  // Idempotency: check DB if already sent
  const existing = await prisma.emailJob.findUnique({ where: { id: jobId } });
  if (existing?.status === 'sent') {
    return; // already done
  }

  // Rate limit check – returns true if allowed, false if limit reached
  const allowed = await acquireRateSlot(senderId);
  if (!allowed) {
    // Reschedule for next hour start
    const now = Date.now();
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const delay = nextHour.getTime() - now;
    await emailQueue.add('send-email', job.data, { delay, attempts: 3 });
    // Notify via Slack if configured
    await sendSlackAlert(senderId, `Hourly email limit reached for sender ${senderId}. Jobs delayed to next hour.`);
    return;
  }

  // Send email via Ethereal
  await transporter.sendMail({
    from: 'no-reply@reachinbox.com',
    to,
    subject,
    html,
  });

  // Update DB status
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: 'sent', sentAt: new Date() },
  });

  // (Optional) Index in Elasticsearch – omitted here for brevity
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY) || 5 });

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('✅ Email worker started');
