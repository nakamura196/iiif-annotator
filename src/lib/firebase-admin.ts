import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;

export function getAdminFirestore(): Firestore {
  if (db) {
    return db;
  }

  if (getApps().length === 0) {
    const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!base64ServiceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
    }

    const serviceAccount = JSON.parse(
      Buffer.from(base64ServiceAccount, 'base64').toString('utf-8')
    );

    app = initializeApp({
      credential: cert(serviceAccount),
    });
  }

  db = getFirestore();
  return db;
}
