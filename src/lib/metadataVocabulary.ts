// ユーザ単位のメタデータ語彙を Firestore に保存/取得する。
//
// 語彙(Vocabulary)は「名前付きのプロパティ集合」で、Omeka S のリソーステンプレートに
// 近い。1 ユーザが複数の語彙（例: pj-a, pj-b）を持ち、各語彙が項目名(properties)の
// リストを持つ。アノテーション編集時に語彙を選ぶと、そのプロパティ群が入力候補
// (datalist)として提示される。値は自由入力。
//
// ドキュメント: metadata_vocabularies/{uid} -> { vocabularies: Vocabulary[] }
// 後方互換: 旧形式 { fields: string[] } は読み取り時に「既定」語彙へ移行する。
//
// 純粋ロジック（正規化・移行・マージ・追記）は metadataVocabulary.helpers.ts に
// 切り出してテスト対象とし、ここは Firestore I/O のみを担う。
import { doc, getDoc, setDoc, getFirestore } from "firebase/firestore";
import { getApps } from "firebase/app";
// 副作用として default app を初期化（firebase.ts が initializeApp を実行）
import "@/lib/firebase";
import {
  type Vocabulary,
  normalizeVocabularies,
  vocabulariesFromDoc,
  addPropertiesTo,
} from "@/lib/metadataVocabulary.helpers";

export type { Vocabulary };
export { normalizeVocabularies };

const COLLECTION = "metadata_vocabularies";

function db() {
  if (getApps().length === 0) {
    throw new Error("Firebase app is not initialized");
  }
  return getFirestore();
}

/** ユーザの語彙一覧を取得。未設定なら空配列（旧 fields 形式は移行）。 */
export async function getVocabularies(uid: string): Promise<Vocabulary[]> {
  if (!uid) return [];
  const snap = await getDoc(doc(db(), COLLECTION, uid));
  if (!snap.exists()) return [];
  return vocabulariesFromDoc(snap.data());
}

/** ユーザの語彙一覧を保存（正規化のうえドキュメントを置換）。 */
export async function saveVocabularies(
  uid: string,
  vocabularies: Vocabulary[]
): Promise<Vocabulary[]> {
  if (!uid) throw new Error("uid is required");
  const cleaned = normalizeVocabularies(vocabularies);
  // 旧 fields キーを残さないよう merge せず置換する
  await setDoc(doc(db(), COLLECTION, uid), {
    vocabularies: cleaned,
    modified: new Date(),
  });
  return cleaned;
}

/**
 * 指定語彙に新しいプロパティを追記（既にあれば何もしない）。返り値は更新後の一覧。
 * 語彙が見つからない / 追記が無い場合は書き込みを行わず現状を返す。
 */
export async function addPropertiesToVocabulary(
  uid: string,
  vocabId: string,
  newProperties: string[]
): Promise<Vocabulary[]> {
  const current = await getVocabularies(uid);
  const next = addPropertiesTo(current, vocabId, newProperties);
  if (next === current) return current; // 変化なし → 書き込み省略
  return saveVocabularies(uid, next);
}
