import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

let _connection: IORedis | null = null;

const getConnection = () => {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true 
    });
    
    _connection.on('error', (err) => {
      console.error('Redis connection error (Rate Limit disabled):', err.message);
    });
  }
  return _connection;
};

// Notifications Queue handles both SMS and FCM
let _notificationsQueue: Queue | null = null;

export const getNotificationsQueue = () => {
  if (!_notificationsQueue) {
    _notificationsQueue = new Queue('notifications', { connection: getConnection() });
    _notificationsQueue.on('error', (err) => {
      console.error('BullMQ error (Rate Limit disabled):', err.message);
    });
  }
  return _notificationsQueue;
};



// Helper to push an SMS job
export async function queueSms(smsQueueId: number, mobile: string, message: string) {
  try {
    console.log(`[Queue Mock] Added SMS job for ${mobile}`);
    // Only queue if not in development to avoid hanging if Redis is absent
    if (process.env.NODE_ENV === 'production') {
      const q = getNotificationsQueue();
      await q.add('send_sms', { smsQueueId, mobile, message }, {
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
      const q = getNotificationsQueue();
      await q.add('send_fcm', { notificationQueueId, token, payload }, {
        attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true
      });
    }
  } catch (error) {
    console.error('Failed to queue FCM:', error);
  }
}
