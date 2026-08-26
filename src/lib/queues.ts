import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

// Create a single shared Redis connection for the queues
// Use the existing REDIS_URL from .env
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true // Prevent immediate connection errors on startup
});

// Notifications Queue handles both SMS and FCM
export const notificationsQueue = new Queue('notifications', { connection });

// Helper to push an SMS job
export async function queueSms(smsQueueId: number, mobile: string, message: string) {
  try {
    console.log(`[Queue Mock] Added SMS job for ${mobile}`);
    // Only queue if not in development to avoid hanging if Redis is absent
    if (process.env.NODE_ENV === 'production') {
      await notificationsQueue.add('send_sms', { smsQueueId, mobile, message }, {
        attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true
      });
    }
  } catch (error) {
    console.error('Failed to queue SMS:', error);
  }
}

// Helper to push an FCM job
export async function queueFcm(notificationQueueId: number, token: string, payload: any) {
  try {
    console.log(`[Queue Mock] Added FCM job`);
    if (process.env.NODE_ENV === 'production') {
      await notificationsQueue.add('send_fcm', { notificationQueueId, token, payload }, {
        attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true
      });
    }
  } catch (error) {
    console.error('Failed to queue FCM:', error);
  }
}
