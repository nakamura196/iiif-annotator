"use client";

import { ExternalLink } from "lucide-react";

export interface MetadataPair {
  label: string;
  value: string;
}

export interface ManifestMeta {
  summary?: string;
  pairs: MetadataPair[];
  requiredStatement?: MetadataPair;
  rights?: string;
  /** 表示中の canvas の情報（ラベル・寸法など） */
  canvas?: MetadataPair[];
}

/**
 * IIIF マニフェスト/カンバスのメタデータを表示するサイドバーパネル。
 * label/value はエディタ側で locale 解決済みの文字列を受け取る。
 */
export function MetadataPanel({
  meta,
  emptyLabel,
}: {
  meta: ManifestMeta | null;
  emptyLabel: string;
}) {
  const isEmpty =
    !meta ||
    (!meta.summary &&
      meta.pairs.length === 0 &&
      !meta.requiredStatement &&
      !meta.rights &&
      (!meta.canvas || meta.canvas.length === 0));

  if (isEmpty) {
    return (
      <div className="flex-1 overflow-y-auto p-4 text-sm text-[var(--ds-fg-muted)]">
        {emptyLabel}
      </div>
    );
  }

  const renderPairs = (pairs: MetadataPair[]) => (
    <dl className="space-y-2">
      {pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2">
          <dt className="text-xs font-medium text-[var(--ds-fg-muted)] break-words">
            {p.label}
          </dt>
          <dd className="text-sm text-[var(--ds-fg)] whitespace-pre-wrap break-words">
            {p.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
      {meta.summary && (
        <p className="text-[var(--ds-fg-muted)] whitespace-pre-wrap break-words">
          {meta.summary}
        </p>
      )}

      {meta.canvas && meta.canvas.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ds-fg-muted)]">
            Canvas
          </h4>
          {renderPairs(meta.canvas)}
        </section>
      )}

      {meta.pairs.length > 0 && renderPairs(meta.pairs)}

      {meta.requiredStatement && (
        <section className="pt-2 border-t border-[var(--ds-border)]">
          {renderPairs([meta.requiredStatement])}
        </section>
      )}

      {meta.rights && (
        <div className="pt-2 border-t border-[var(--ds-border)]">
          <a
            href={meta.rights}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--ds-primary)] hover:underline break-all"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            {meta.rights}
          </a>
        </div>
      )}
    </div>
  );
}
