import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnnotationList } from "./AnnotationList";
import type { AnnotationWithMultipleBodies } from "@/types/annotation";

// next-intl をモック（キーをそのまま日本語っぽく返す最小実装）
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      locale: "ja",
      annotations: "アノテーション",
      emptyText: "(本文なし)",
      noAnnotations: "アノテーションはありません",
      created: "作成",
      modified: "更新",
      focusAnnotation: "領域へ移動",
      selectMode: "選択",
      selectAll: "すべて選択",
      deselectAll: "選択解除",
      delete: "削除",
      cancel: "キャンセル",
      sortNewest: "新しい順",
      sortOldest: "古い順",
      sortTextAsc: "テキスト昇順",
      sortTextDesc: "テキスト降順",
    };
    if (key === "selectedCount") return `${vars?.count} 件選択中`;
    return map[key] ?? key;
  },
}));

// テスト用のアノテーションを組み立てるヘルパ
const makeAnnotation = (
  overrides: Partial<AnnotationWithMultipleBodies>
): AnnotationWithMultipleBodies =>
  ({
    id: "anno-1",
    motivation: "commenting",
    type: "Annotation",
    body: [{ type: "TextualBody", value: "百鬼夜行" }],
    target: {
      selector: [{ type: "FragmentSelector", value: "xywh=0,0,10,10" }],
      source: { id: "canvas-1", type: "Canvas", partOf: { id: "m", type: "Manifest" } },
    },
    ...overrides,
  }) as AnnotationWithMultipleBodies;

const noop = () => {};

const renderList = (annotations: AnnotationWithMultipleBodies[]) =>
  render(
    <AnnotationList
      annotations={annotations}
      onDelete={noop}
      onSelect={noop}
      onFocus={noop}
    />
  );

describe("AnnotationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("各行に label と body(本文) を表示する", () => {
    renderList([makeAnnotation({ id: "a1" })]);
    expect(screen.getByText("百鬼夜行")).toBeInTheDocument();
  });

  it("件数を表示する", () => {
    renderList([
      makeAnnotation({ id: "a1" }),
      makeAnnotation({ id: "a2", body: [{ type: "TextualBody", value: "鬼" }] }),
    ]);
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("0件のときはプレースホルダを表示する", () => {
    renderList([]);
    expect(screen.getByText("アノテーションはありません")).toBeInTheDocument();
  });

  // --- ここからが今回の追加機能（メタデータのチップ表示）の回帰テスト ---

  it("登録済みメタデータを項目名+値のチップとして一覧に表示する", () => {
    renderList([
      makeAnnotation({
        id: "a1",
        metadata: [
          { label: "種別", value: "絵巻物" },
          { label: "時代", value: "室町時代" },
        ],
      }),
    ]);
    // 項目名と値の両方が描画される
    expect(screen.getByText("種別")).toBeInTheDocument();
    expect(screen.getByText("絵巻物")).toBeInTheDocument();
    expect(screen.getByText("時代")).toBeInTheDocument();
    expect(screen.getByText("室町時代")).toBeInTheDocument();
    // チップは title 属性に "label: value" を持つ（ホバーで全文確認できる）
    expect(screen.getByTitle("種別: 絵巻物")).toBeInTheDocument();
    expect(screen.getByTitle("時代: 室町時代")).toBeInTheDocument();
  });

  it("メタデータが無いアノテーションではチップを描画しない", () => {
    renderList([makeAnnotation({ id: "a1", metadata: [] })]);
    // ":" を含む title のチップが存在しない
    expect(screen.queryByTitle(/.+: .+/)).not.toBeInTheDocument();
  });

  it("metadata が undefined でも落ちずにチップ無しで描画する", () => {
    renderList([makeAnnotation({ id: "a1", metadata: undefined })]);
    expect(screen.getByText("百鬼夜行")).toBeInTheDocument();
    expect(screen.queryByTitle(/.+: .+/)).not.toBeInTheDocument();
  });

  it("label も value も空の行はチップとして表示しない（空行を出さない）", () => {
    renderList([
      makeAnnotation({
        id: "a1",
        metadata: [
          { label: "", value: "" },
          { label: "材質", value: "紙本着色" },
        ],
      }),
    ]);
    // 有効な行だけが出る
    expect(screen.getByTitle("材質: 紙本着色")).toBeInTheDocument();
    // 空チップ（title が ": "）は出ない
    expect(screen.queryByTitle(": ")).not.toBeInTheDocument();
    // チップは1つだけ
    expect(screen.getAllByTitle(/材質/)).toHaveLength(1);
  });

  it("label のみ / value のみの行も片側だけ表示する", () => {
    renderList([
      makeAnnotation({
        id: "a1",
        metadata: [
          { label: "作者", value: "" },
          { label: "", value: "土佐光信" },
        ],
      }),
    ]);
    expect(screen.getByText("作者")).toBeInTheDocument();
    expect(screen.getByText("土佐光信")).toBeInTheDocument();
  });

  it("行クリックで onSelect が呼ばれる（既存の選択動作が維持される）", async () => {
    const onSelect = vi.fn();
    render(
      <AnnotationList
        annotations={[makeAnnotation({ id: "a1" })]}
        onDelete={noop}
        onSelect={onSelect}
        onFocus={noop}
      />
    );
    await userEvent.click(screen.getByText("百鬼夜行"));
    expect(onSelect).toHaveBeenCalledWith("a1");
  });

  it("複数アノテーションそれぞれに対応するメタデータを表示する", () => {
    renderList([
      makeAnnotation({
        id: "a1",
        body: [{ type: "TextualBody", value: "百鬼夜行" }],
        metadata: [{ label: "種別", value: "絵巻物" }],
      }),
      makeAnnotation({
        id: "a2",
        body: [{ type: "TextualBody", value: "鬼" }],
        metadata: [{ label: "数", value: "百" }],
      }),
    ]);
    // それぞれのチップが別個に存在する
    const chip1 = screen.getByTitle("種別: 絵巻物");
    const chip2 = screen.getByTitle("数: 百");
    expect(chip1).toBeInTheDocument();
    expect(chip2).toBeInTheDocument();
    expect(within(chip1).getByText("種別")).toBeInTheDocument();
    expect(within(chip2).getByText("数")).toBeInTheDocument();
  });
});
