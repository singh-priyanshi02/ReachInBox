// src/routes/email.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, EmailJobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import csvParse from 'csv-parse/lib/sync';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Expected payload:
// {
//   subject: string,
//   html: string,
//   senderId: string,
//   startTime: ISOString,
//   leadsCsv: string (base64 or raw text),
// }
router.post('/schedule', async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req.app.locals.prisma as PrismaClient);
  const emailQueue: Queue = (req.app.locals.emailQueue as Queue);
  const { subject, html, senderId, startTime, leadsCsv } = req.body;
  if (!subject || !html || !senderId || !startTime || !leadsCsv) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Parse CSV – assume one column with email addresses
  let emails: string[] = [];
  try {
    const records = csvParse(leadsCsv, { trim: true, skip_empty_lines: true });
    emails = records.flat();
  } catch (e) {
    return res.status(400).json({ error: 'Invalid CSV format' });
  }

  const scheduledTimestamp = new Date(startTime).getTime();
  const now = Date.now();
  const delayBase = Math.max(scheduledTimestamp - now, 0);

  const createdJobs = [];
  for (const to of emails) {
    const jobId = uuidv4();
    // Store in DB
    await prisma.emailJob.create({
      data: {
        id: jobId,
        to,
        subject,
        html,
        senderId,
        status: 'scheduled' as EmailJobStatus,
        scheduledAt: new Date(startTime),
      },
    });
    // Add to BullMQ with base delay; per‑email delay can be added later via limiter or custom delay
    await emailQueue.add('send-email', { jobId, to, subject, html, senderId }, { delay: delayBase });
    createdJobs.push({ jobId, to });
  }

  res.json({ scheduled: createdJobs.length, jobs: createdJobs });
});

export default router;
