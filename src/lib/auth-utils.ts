import { getAuth } from 'firebase-admin/auth';
import { getAdminFirestore } from './firebase-admin';

export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('verifyIdToken: missing or invalid Authorization header:', authHeader ? `"${authHeader.substring(0, 20)}..."` : 'null');
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Ensure Firebase Admin is initialized
    getAdminFirestore();

    const decodedToken = await getAuth().verifyIdToken(token);
    return { uid: decodedToken.uid };
  } catch (error) {
    console.error('verifyIdToken failed:', error);
    return null;
  }
}
