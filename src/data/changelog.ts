export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  version?: string;
  title: { ja: string; en: string };
  description: { ja: string; en: string };
  type: "feature" | "improvement" | "fix" | "breaking";
}

/**
 * Changelog entries — newest first.
 * Add new entries at the top of the array.
 */
export const changelog: ChangelogEntry[] = [
  {
    date: "2026-04-06",
    title: {
      ja: "サムネイルナビゲーション機能を追加",
      en: "Added thumbnail navigation",
    },
    description: {
      ja: "編集画面にサムネイル一覧を追加しました。左サイドバーでアノテーション一覧とサムネイル一覧をタブで切り替えられます。ビューア下部にもサムネイルストリップを表示し、ページ間の移動が容易になりました。",
      en: "Added thumbnail browsing to the editor. Switch between annotation list and thumbnail list in the left sidebar. A thumbnail strip below the viewer also enables easy page navigation.",
    },
    type: "feature",
  },
  {
    date: "2026-03-15",
    title: {
      ja: "OCR文字認識機能を追加",
      en: "Added OCR text recognition",
    },
    description: {
      ja: "NDL古典籍OCR-liteを利用した、ブラウザ上での日本語古典籍文字認識機能を追加しました。認識結果をアノテーションとして保存できます。",
      en: "Added client-side Japanese classical document OCR using NDL Koten OCR-lite. OCR results can be saved as annotations.",
    },
    type: "feature",
  },
  {
    date: "2026-02-20",
    title: {
      ja: "マイアノテーション一覧ページを追加",
      en: "Added My Annotations page",
    },
    description: {
      ja: "ログインユーザーが保存した全アノテーションを横断的に検索・閲覧できるページを追加しました。",
      en: "Added a page for logged-in users to search and browse all their saved annotations across manifests.",
    },
    type: "feature",
  },
  {
    date: "2026-01-10",
    title: {
      ja: "TEI/XMLエクスポート機能",
      en: "TEI/XML export",
    },
    description: {
      ja: "アノテーションをTEI/XML形式でエクスポートできるようになりました。デジタル人文学の研究に活用できます。",
      en: "Annotations can now be exported in TEI/XML format for digital humanities research.",
    },
    type: "feature",
  },
];
