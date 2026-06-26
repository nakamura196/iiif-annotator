import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App | undefined;
let db: Firestore | undefined;

function ensureApp(): App {
  if (app) {
    return app;
  }

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

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

  return app;
}

export function getAdminFirestore(): Firestore {
  if (db) {
    return db;
  }

  ensureApp();
  db = getFirestore();
  return db;
}

/** Firebase Admin Auth（ブラウザの ID トークン検証に使う）。 */
export function getAdminAuth(): Auth {
  return getAuth(ensureApp());
}
