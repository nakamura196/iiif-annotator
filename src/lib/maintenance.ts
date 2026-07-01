// メンテナンス（作業停止）モード。
//
// データ移行など「一時的に書き込みを止めたい」場面のためのスイッチ。2 系統で ON にできる:
//
//   1. 環境変数 MAINTENANCE_MODE=1 … 再デプロイで確実に固定したい時。最優先。
//      （デプロイ単位で状態が決まるので、切り忘れ・競合が起きにくい）
//   2. Firestore の system/maintenance { enabled, message } … 再デプロイなしに即時 ON/OFF
//      したい時（切替は admin リポのスクリプトから service account で行う）。
//
//   - 書き込み API (POST/PUT/DELETE) は有効な間 503 を返す（サーバ側で確実に遮断）。
//   - 読み取りは止めない（閲覧は継続できる）。
//   - クライアントは /api/system/maintenance を読んでバナー表示と保存無効化を行う。

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export interface MaintenanceState {
  enabled: boolean;
  message?: string;
}

const DEFAULT_MESSAGE =
  'ただいまメンテナンス（データ移行）のため、一時的に保存できません。しばらくお待ちください。';

function envEnabled(): boolean {
  const v = process.env.MAINTENANCE_MODE;
  return v === '1' || v === 'true';
}

// クライアントは 2 分ごとにポーリングするため、Firestore フラグ読み取りを
// プロセス内で短時間キャッシュし、read 増幅（＝今回の削減目的に逆行）を防ぐ。
// TTL 経過 or 未設定時のみ実際に 1 read する。フラグ切替は最大 TTL 分だけ遅延して反映。
const CACHE_TTL_MS = 30_000;
let cache: { state: MaintenanceState; at: number } | null = null;
// Date.now は使えるが、テスト等での固定用に薄く包む。
function nowMs(): number {
  return Date.now();
}

/** メンテナンス状態を返す。環境変数が ON なら最優先で有効。次に Firestore フラグ（TTLキャッシュ）。 */
export async function getMaintenance(): Promise<MaintenanceState> {
  if (envEnabled()) {
    return { enabled: true, message: process.env.MAINTENANCE_MESSAGE || DEFAULT_MESSAGE };
  }
  if (cache && nowMs() - cache.at < CACHE_TTL_MS) {
    return cache.state;
  }
  let state: MaintenanceState;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('system').doc('maintenance').get();
    if (!snap.exists) {
      state = { enabled: false };
    } else {
      const data = snap.data() as { enabled?: boolean; message?: string };
      state = {
        enabled: data.enabled === true,
        message: typeof data.message === 'string' && data.message ? data.message : DEFAULT_MESSAGE,
      };
    }
  } catch {
    // フラグが読めないことで通常運用を止めないよう、フェイルオープンにする。
    state = { enabled: false };
  }
  cache = { state, at: nowMs() };
  return state;
}

/** メンテナンス中なら 503 レスポンスを返す。通常運用なら null（呼び出し側は続行）。 */
export async function assertNotInMaintenance(): Promise<NextResponse | null> {
  const state = await getMaintenance();
  if (!state.enabled) return null;
  return NextResponse.json(
    { error: state.message ?? DEFAULT_MESSAGE, maintenance: true },
    { status: 503 }
  );
}
