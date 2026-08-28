import { messaging } from './src/lib/firebase-admin.js';

async function testPush() {
  if (!messaging) {
    console.error('Firebase Admin not initialized.');
    process.exit(1);
  }

  const token = 'eiZcqCAJRzuxdVhW38cNtX:APA91bFQLIFZHt0tDk5Otraagnp_dhFExT6cktYpiHgFwNYziDRuTPC1zAG2Ji5Si4z_DbDlSue1yvEmzAarHWSUlUywAQw8sq5LYcM9o3ZfLOk5wD9AiK8'; // The Linux Delivery Partner token

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: [token],
      notification: {
        title: 'Test Notification from CLI',
        body: 'If you see this, FCM is working perfectly!',
      },
      data: {
        url: '/partner/orders',
      },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: '/partner/orders' },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200, 100, 200]
        }
      }
    });

    console.log('FCM Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('FCM Error:', error);
  }
}

testPush().then(() => process.exit(0));
