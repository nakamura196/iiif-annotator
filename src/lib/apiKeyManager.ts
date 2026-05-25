import { createHash, randomBytes } from 'crypto';
import { getAdminFirestore } from './firebase-admin';
import { ApiKeyDocument, ApiKeyValidationResult } from '@/types/apiKey';
import { Timestamp } from 'firebase-admin/firestore';

const API_KEYS_COLLECTION = 'api_keys';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  const db = getAdminFirestore();
  const keyHash = hashApiKey(apiKey);

  const snapshot = await db
    .collection(API_KEYS_COLLECTION)
    .where('keyHash', '==', keyHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { valid: false, error: 'Invalid API key' };
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as ApiKeyDocument;

  if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
    return { valid: false, error: 'API key has expired' };
  }

  return { valid: true, userId: data.userId };
}

export async function createApiKey(
  userId: string,
  name: string,
  expiresAt?: Date
): Promise<{ key: string; id: string }> {
  const db = getAdminFirestore();
  const key = generateApiKey();
  const keyHash = hashApiKey(key);

  const docData: ApiKeyDocument = {
    keyHash,
    userId,
    name,
    createdAt: Timestamp.now(),
    ...(expiresAt && { expiresAt: Timestamp.fromDate(expiresAt) }),
  };

  const docRef = await db.collection(API_KEYS_COLLECTION).add(docData);

  return { key, id: docRef.id };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(API_KEYS_COLLECTION).doc(keyId).delete();
}

export async function listApiKeys(userId: string): Promise<Array<{ id: string; name: string; createdAt: Date; expiresAt?: Date }>> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(API_KEYS_COLLECTION)
    .where('userId', '==', userId)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as ApiKeyDocument;
    return {
      id: doc.id,
      name: data.name,
      createdAt: data.createdAt.toDate(),
      ...(data.expiresAt && { expiresAt: data.expiresAt.toDate() }),
    };
  });
}
