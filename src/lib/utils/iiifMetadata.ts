// IIIF マニフェストから、サイドバー「情報」タブ用のメタデータを抽出する。
// label/value は v2/v3 どちらの形式でも getIIIFLabel でロケール解決する。

import { getIIIFLabel } from "@/lib/utils/iiifLabel";
import type { ManifestMeta, MetadataPair } from "@/components/annotation/MetadataPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractManifestMeta(manifest: any, locale: string): ManifestMeta {
  const pairs: MetadataPair[] = [];
  const md = Array.isArray(manifest?.metadata) ? manifest.metadata : [];
  for (const m of md) {
    const label = getIIIFLabel(m?.label, locale);
    const value = getIIIFLabel(m?.value, locale);
    if (label || value) pairs.push({ label, value });
  }

  const summary = manifest?.summary ? getIIIFLabel(manifest.summary, locale) : "";

  let requiredStatement: MetadataPair | undefined;
  const rs = manifest?.requiredStatement;
  if (rs && (rs.label || rs.value)) {
    requiredStatement = {
      label: getIIIFLabel(rs.label, locale),
      value: getIIIFLabel(rs.value, locale),
    };
  }

  const rights = typeof manifest?.rights === "string" ? manifest.rights : "";

  return { summary, pairs, requiredStatement, rights };
}
