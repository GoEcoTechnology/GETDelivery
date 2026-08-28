import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db';
import { smsQueue, notificationQueue } from '../db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

console.log('🚀 Starting Notification Worker (BullMQ)...');

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin if it hasn't been already
if (!getApps().length) {
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      credential = cert(serviceAccount);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
    }

    if (credential) {
      initializeApp({ credential });
      console.log('Firebase Admin initialized successfully in worker.');
    } else {
      console.warn('Firebase credentials not found in worker. FCM pushes will fail if attempted.');
    }
  } catch (err: any) {
    console.error('Failed to initialize Firebase Admin in worker:', err.message);
  }
}

const worker = new Worker('notifications', async (job) => {
  if (job.name === 'send_sms') {
    const { smsQueueId, mobile, message } = job.data;
    
    // Update DB to PROCESSING
    await db.update(smsQueue)
      .set({ status: 'PROCESSING', attemptCount: job.attemptsMade + 1 })
      .where(eq(smsQueue.id, smsQueueId));

    try {
      // SIMULATED SMS PROVIDER (e.g. Twilio or SNS would go here)
      console.log(`[SMS] Sending to ${mobile}: "${message}"`);
      
      // Simulate network delay
      await new Promise(res => setTimeout(res, 500));
      
      // Simulate provider response ID
      const providerId = `sim_sms_${Date.now()}`;

      // Mark SENT
      await db.update(smsQueue)
        .set({ status: 'SENT', sentAt: new Date(), providerMessageId: providerId })
        .where(eq(smsQueue.id, smsQueueId));
        
      console.log(`[SMS] ✅ Sent to ${mobile}`);
      
    } catch (error: any) {
      console.error(`[SMS] ❌ Failed to send to ${mobile}: ${error.message}`);
      
      await db.update(smsQueue)
        .set({ status: 'FAILED', failedAt: new Date() })
        .where(eq(smsQueue.id, smsQueueId));
        
      throw error; // Let BullMQ handle retry/backoff
    }

  } else if (job.name === 'send_fcm') {
    const { notificationQueueId, token, payload } = job.data;
    
    await db.update(notificationQueue)
      .set({ status: 'PROCESSING', attemptCount: job.attemptsMade + 1 })
      .where(eq(notificationQueue.id, notificationQueueId));

    try {
      if (!getApps().length) {
        throw new Error('Firebase Admin is not initialized. Check FIREBASE_SERVICE_ACCOUNT_BASE64.');
      }

      console.log(`[FCM] Sending push to ${token}...`);
      
      const message = {
        token: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          fcmOptions: {
            link: payload.data?.action_url || payload.data?.url || '/'
          },
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            vibrate: [200, 100, 200, 100, 200]
          }
        }
      };

      const providerId = await getMessaging().send(message);

      await db.update(notificationQueue)
        .set({ status: 'SENT', sentAt: new Date(), providerMessageId: providerId })
        .where(eq(notificationQueue.id, notificationQueueId));
        
      console.log(`[FCM] ✅ Push sent to ${token}, messageId: ${providerId}`);

    } catch (error: any) {
      console.error(`[FCM] ❌ Failed push to ${token}: ${error.message}`);
      
      await db.update(notificationQueue)
        .set({ status: 'FAILED', failedAt: new Date() })
        .where(eq(notificationQueue.id, notificationQueueId));
        
      // Invalid token cleanup
      if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
        console.log(`[FCM] Cleaning up invalid token: ${token}`);
        const { deviceTokens } = await import('../db/schema');
        await db.delete(deviceTokens).where(eq(deviceTokens.fcmToken, token));
      }
        
      throw error;
    }
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});

worker.on('error', err => {
  console.error('Worker error:', err);
});
