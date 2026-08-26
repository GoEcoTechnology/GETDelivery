import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const notificationQueue = new Queue('notificationQueue', { connection });
export const smsQueue = new Queue('smsQueue', { connection });

// Workers should ideally be run in a separate process or a dedicated long-running script,
// but for Next.js they can be initialized carefully on the server side.
export function initWorkers() {
  if (process.env.NODE_ENV !== 'production' && (global as any).workersStarted) {
    return;
  }

  const notificationWorker = new Worker('notificationQueue', async job => {
    console.log(`Processing notification job ${job.id}`, job.data);
    // TODO: Implement FCM sending logic here
  }, { connection });

  const smsWorker = new Worker('smsQueue', async job => {
    console.log(`Processing SMS job ${job.id}`, job.data);
    // TODO: Implement SMS sending logic here
  }, { connection });

  (global as any).workersStarted = true;
  console.log("BullMQ Workers started");
}
