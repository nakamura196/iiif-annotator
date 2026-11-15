// Server-side Firebase access (Firestore + ID token verification).
//
// Backed by the REST client in ./firestore-rest rather than the firebase-admin package,
// because firebase-admin does not run on Cloudflare Workers. The exported function names
// are kept so existing call sites and test mocks (`vi.mock('@/lib/firebase-admin')`) work.
// (firebase-admin itself remains a devDependency for the local maintenance scripts in scripts/.)

import {
  Firestore,
  FirebaseAuthVerifier,
  GoogleAccessTokenProvider,
  type ServiceAccount,
} from './firestore-rest';

let serviceAccount: ServiceAccount | undefined;
let db: Firestore | undefined;
let auth: FirebaseAuthVerifier | undefined;

function loadServiceAccount(): ServiceAccount {
  if (serviceAccount) return serviceAccount;

  const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64ServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
  }

  const parsed = JSON.parse(Buffer.from(base64ServiceAccount, 'base64').toString('utf-8'));
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not a service account JSON');
  }
  serviceAccount = parsed as ServiceAccount;
  return serviceAccount;
}

export function getAdminFirestore(): Firestore {
  if (db) return db;
  const sa = loadServiceAccount();
  const tokens = new GoogleAccessTokenProvider(sa);
  db = new Firestore(sa.project_id, () => tokens.get());
  return db;
}

/** Verifies browser ID tokens issued by Firebase Auth. */
export function getAdminAuth(): FirebaseAuthVerifier {
  if (auth) return auth;
  auth = new FirebaseAuthVerifier(loadServiceAccount().project_id);
  return auth;
}
