import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    let credential;
    
    // Check if the service account JSON string is provided in Base64
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(decoded);
        credential = cert(serviceAccount);
      } catch (e: any) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
      }
    }
    // Fallback to old format if still present
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = cert(serviceAccount);
      } catch (e: any) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', e.message);
      }
    } 
    // Fallback to checking individual env variables (common on Vercel)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }

    if (credential) {
      initializeApp({
        credential,
      });
      console.log('Firebase Admin initialized successfully.');
    } else {
      console.warn('Firebase Admin SDK not initialized: Missing credentials in environment variables.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const messaging = getApps().length ? getMessaging() : null;
