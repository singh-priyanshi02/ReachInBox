import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Queue, QueueScheduler, Worker, QueueEvents } from 'bullmq';
import { createBullBoard } from 'bull-board';
import { ExpressAdapter } from 'bull-board/dist/ExpressAdapter';
import emailRouter from './routes/email';
import cors from 'cors';
import { createClient } from 'ioredis';

ddotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Redis connection
const connection = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// BullMQ queue and scheduler
const emailQueueName = 'emailQueue';
const emailQueue = new Queue(emailQueueName, { connection });
const emailScheduler = new QueueScheduler(emailQueueName, { connection });
const emailQueueEvents = new QueueEvents(emailQueueName, { connection });

// Bull Board UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new Queue(emailQueueName, { connection })], serverAdapter });
app.use('/admin/queues', serverAdapter.getRouter());

// Make queue and prisma available to routes via locals
app.locals.prisma = prisma;
app.locals.emailQueue = emailQueue;

app.use('/api/email', emailRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Email scheduler API listening on port ${PORT}`);
});

export { app, emailQueue, emailQueueEvents, prisma };
