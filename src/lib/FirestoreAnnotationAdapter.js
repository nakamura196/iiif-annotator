import { getAuth } from "firebase/auth";

/**
 * アノテーションのアダプター（API ファースト版）。
 *
 * 以前はブラウザの Firebase クライアント SDK で Firestore を直接読み書きしていたが、
 * 作成時に採番される Firestore の doc ID と Annotorious の一時 ID がズレ、update/delete が
 * 静かに失敗していた（catch で握り潰されて画面だけ更新されたように見える不具合）。
 *
 * 現在はサーバ側 REST API (/api/annotations) を唯一の書き込み経路とし、ブラウザは
 * Firebase の ID トークン（Authorization: Bearer）で認証する。サーバが doc ID を
 * 権威ある id として返すため、ID 不整合が構造的に発生しない。失敗は例外として
 * 呼び出し側に伝播する（握り潰さない）。
 */
export default class FirestoreAnnotationAdapter {
  /** */
  constructor(canvasId, manifestId) {
    this.canvasId = canvasId;
    this.manifestId = manifestId;
  }

  /** */
  get annotationPageId() {
    return `${this.canvasId}/annotations`;
  }

  /** 現在ユーザの Firebase ID トークン付きヘッダ。未ログインなら null。 */
  async authHeaders() {
    const user = getAuth().currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  /** ISO 文字列を AnnotationList が期待する {seconds, nanoseconds} 形へ。 */
  static toTimestamp(iso) {
    if (!iso) return undefined;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return undefined;
    return {
      seconds: Math.floor(ms / 1000),
      nanoseconds: (ms % 1000) * 1000000,
      type: "firestore/timestamp/1.0",
    };
  }

  /** API レスポンスのアノテーションを UI 用に整形（タイムスタンプ形を復元）。 */
  static normalize(item) {
    return {
      ...item,
      created: FirestoreAnnotationAdapter.toTimestamp(item.created),
      modified: FirestoreAnnotationAdapter.toTimestamp(item.modified),
    };
  }

  /** GET から自 manifest 分の items を取り出す共通処理。 */
  async fetchItems(url) {
    const headers = await this.authHeaders();
    if (!headers) return [];
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`アノテーションの取得に失敗しました (${res.status})`);
    }
    const data = await res.json();
    const group = (data.annotations || []).find((g) => g.manifestId === this.manifestId);
    return (group?.items || []).map(FirestoreAnnotationAdapter.normalize);
  }

  /** この canvas のアノテーションだけを取得（サーバはページ 1 ドキュメント = 1 read）。 */
  async fetchCanvasItems() {
    const url =
      `/api/annotations?manifestIds=${encodeURIComponent(this.manifestId)}` +
      `&canvasId=${encodeURIComponent(this.canvasId)}`;
    return this.fetchItems(url);
  }

  /** manifest 全体（全 canvas）のアノテーションを取得。export 用。 */
  async fetchManifestItems() {
    return this.fetchItems(`/api/annotations?manifestIds=${encodeURIComponent(this.manifestId)}`);
  }

  /** 失敗レスポンスからメッセージを取り出す。 */
  static async errorMessage(res, fallback) {
    try {
      const data = await res.json();
      if (data?.error) {
        return data.details?.length ? `${data.error}: ${data.details.join(", ")}` : data.error;
      }
    } catch {
      /* noop */
    }
    return `${fallback} (${res.status})`;
  }

  /** */
  async create(annotation) {
    const headers = await this.authHeaders();
    if (!headers) {
      window.alert("ログインが必要です");
      return null;
    }
    const payload = {
      manifestId: this.manifestId,
      canvasId: this.canvasId,
      motivation: annotation.motivation,
      type: annotation.type,
      body: annotation.body,
      target: annotation.target,
      ...(annotation.metadata ? { metadata: annotation.metadata } : {}),
    };
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await FirestoreAnnotationAdapter.errorMessage(res, "作成に失敗しました"));
    }
    // 再取得は呼び出し側（editor の reloadAnnotations）で 1 回だけ行う。ここでは
    // this.all() を呼ばず、二重フェッチによる無駄な読み取りを避ける。
    return res.json();
  }

  /** */
  async update(annotation) {
    const headers = await this.authHeaders();
    if (!headers) {
      window.alert("ログインが必要です");
      return null;
    }
    if (!annotation?.id) {
      throw new Error("更新対象の id がありません");
    }
    const payload = {
      manifestId: this.manifestId,
      canvasId: this.canvasId,
      motivation: annotation.motivation,
      type: annotation.type,
      body: annotation.body,
      target: annotation.target,
      ...(annotation.metadata ? { metadata: annotation.metadata } : {}),
    };
    const res = await fetch(`/api/annotations/${encodeURIComponent(annotation.id)}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await FirestoreAnnotationAdapter.errorMessage(res, "更新に失敗しました"));
    }
    return res.json();
  }

  /** */
  async delete(annoId) {
    const headers = await this.authHeaders();
    if (!headers) {
      window.alert("ログインが必要です");
      return null;
    }
    const res = await fetch(`/api/annotations/${encodeURIComponent(annoId)}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      throw new Error(await FirestoreAnnotationAdapter.errorMessage(res, "削除に失敗しました"));
    }
    return res.json();
  }

  /** */
  async get(annoId) {
    const headers = await this.authHeaders();
    if (!headers) return null;
    const res = await fetch(`/api/annotations/${encodeURIComponent(annoId)}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(await FirestoreAnnotationAdapter.errorMessage(res, "取得に失敗しました"));
    }
    const data = await res.json();
    return data.annotation ? FirestoreAnnotationAdapter.normalize(data.annotation) : null;
  }

  /** Returns an AnnotationPage with this canvas' annotations（canvas 単位で 1 read）。 */
  async all() {
    const items = await this.fetchCanvasItems();
    return {
      id: this.annotationPageId,
      items,
      type: "AnnotationPage",
    };
  }

  /** Returns an AnnotationPage with all annotations of the manifest (全 canvas) */
  async export() {
    const items = await this.fetchManifestItems();
    return {
      items,
      type: "AnnotationPage",
    };
  }
}
