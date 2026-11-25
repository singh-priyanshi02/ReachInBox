import { Queue, QueueScheduler, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const emailQueue = new Queue('emailQueue', { connection });
export const emailQueueScheduler = new QueueScheduler('emailQueue', { connection });
export const emailQueueEvents = new QueueEvents('emailQueue', { connection });

// Export for worker usage
export const getQueueConnection = () => connection;
