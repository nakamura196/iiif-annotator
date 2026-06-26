import ApiDocs from "@/components/ApiDocs";

export const metadata = {
  title: "API ドキュメント | IIIF Annotator",
};

// アノテーション API の Swagger ドキュメント。/api/openapi の定義を描画する。
export default function ApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold">API ドキュメント</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        アノテーションの取得・作成・更新・削除 API。設定画面で発行した API キー
        （<code>X-API-Key</code>）でその場から試せます。
      </p>
      <ApiDocs />
    </div>
  );
}
