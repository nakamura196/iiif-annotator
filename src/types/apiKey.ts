import { Timestamp } from 'firebase-admin/firestore';

export interface ApiKeyDocument {
  keyHash: string;
  userId: string;
  name: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}
