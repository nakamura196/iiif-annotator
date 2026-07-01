import { NextResponse } from 'next/server';
import { getMaintenance } from '@/lib/maintenance';

/** GET /api/system/maintenance — メンテナンス状態（公開）。クライアントのバナー表示用。 */
export async function GET() {
  const state = await getMaintenance();
  return NextResponse.json(state);
}
