import { db } from './src/db/index.js';
import { deviceTokens, deliveryPartners } from './src/db/schema.js';
import { eq, or, inArray, and } from 'drizzle-orm';
import { messaging } from './src/lib/firebase-admin.js';

async function simulateDispatch() {
  // Find eligible ACTIVE delivery partners
  const eligiblePartners = await db
    .select({ 
      id: deliveryPartners.id, 
      mobileNumber: deliveryPartners.mobileNumber,
      companyName: deliveryPartners.companyName
    })
    .from(deliveryPartners)
    .where(or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')));
    
  console.log(`Found ${eligiblePartners.length} eligible partners`);

  if (eligiblePartners.length === 0) {
    console.log('No active delivery partners available');
    return;
  }

  const partnerIds = eligiblePartners.map((p) => p.id);
  console.log('Partner IDs:', partnerIds);

  const tokens = await db
    .select({ fcmToken: deviceTokens.fcmToken })
    .from(deviceTokens)
    .where(
      and(
        inArray(deviceTokens.userId, partnerIds),
        eq(deviceTokens.userRole, 'DELIVERY_PARTNER')
      )
    );

  console.log('Tokens found:', tokens);

  const fcmTokens = tokens.map((t) => t.fcmToken);

  if (fcmTokens.length > 0) {
    console.log('Sending multicast to', fcmTokens.length, 'tokens');
    const messageTitle = 'New Delivery Request (Simulated)';
    const messageBody = `New order ready for pickup.\nOrder #SO-000TEST\nTap to view details.`;
    
    if (!messaging) {
      console.error('Messaging is null!');
      return;
    }

    const response = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title: messageTitle,
        body: messageBody,
      },
      data: {
        url: `/partner/orders/1`,
        action: 'view_order',
        order_id: '1',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcmOptions: {
          link: `/partner/orders/1`
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200, 100, 200]
        }
      }
    });

    console.log('Multicast response:', JSON.stringify(response, null, 2));
  } else {
    console.log('No FCM tokens found for eligible partners');
  }
}

simulateDispatch().catch(console.error).finally(() => process.exit(0));
