import { convertPresentation2 } from "@iiif/parser/presentation-2";
import type { Manifest } from "@iiif/presentation-3";
import type { AnnotationWidthSingleBody } from "@/types/annotation";
import type { Zone } from "@/types/zone";

export async function createMappings(
  annotations: AnnotationWidthSingleBody[]
): Promise<[string, { canvas: string; image: string; zones: Zone[] }[]]> {
  if (annotations.length === 0) return ["", []];

  const manifestId = annotations[0].manifestId;
  if (!manifestId) return ["", []];

  const manifest = await fetchAndNormalizeManifest(manifestId);
  const canvasMapping = createCanvasMapping(manifest);
  const zonesByCanvas = createZonesByCanvas(annotations, canvasMapping);

  return [manifestId, formatResults(zonesByCanvas, canvasMapping)];
}

async function fetchAndNormalizeManifest(manifestId: string) {
  const manifest = await fetch(manifestId).then((res) => res.json());
  const context = manifest["@context"];
  return context?.includes("presentation/2")
    ? convertPresentation2(manifest)
    : manifest;
}

function createCanvasMapping(manifest: Manifest) {
  const mapping: Record<string, { id: string; image: string }> = {};

  for (const canvas of manifest.items) {
    const body = canvas.items?.[0]?.items?.[0]?.body as {
      service: { "@id": string }[];
    };
    const imageService = body?.service?.[0]?.["@id"];
    if (!imageService) continue;

    mapping[canvas.id] = {
      id: canvas.id,
      image: imageService,
    };
  }

  return mapping;
}

function createZonesByCanvas(
  annotations: AnnotationWidthSingleBody[],
  canvasMapping: Record<string, { id: string; image: string }>
) {
  const zonesByCanvas: Record<string, Zone[]> = {};

  // Initialize empty arrays for each canvas
  Object.keys(canvasMapping).forEach((id) => {
    zonesByCanvas[id] = [];
  });

  // Process annotations
  for (const annotation of annotations) {
    if (!annotation.canvasId) continue;

    const zone = createZoneFromAnnotation(annotation);
    zonesByCanvas[annotation.canvasId].push(zone);
  }

  return zonesByCanvas;
}

function createZoneFromAnnotation(annotation: AnnotationWidthSingleBody): Zone {
  let coordinates = { ulx: 0, uly: 0, lrx: 0, lry: 0 };
  let points: string | undefined;

  for (const selector of annotation.target.selector) {
    if (selector.type === "FragmentSelector") {
      coordinates = parseFragmentSelector(selector.value);
    } else if (selector.type === "SvgSelector") {
      points = createPoints(selector.value);
    }
  }

  return {
    ana: stripHtml(annotation.body.value),
    ...coordinates,
    ...(points && { points }),
  };
}

function createPoints(svgValue: string): string {
  const pathD =
    typeof svgValue === "string" && svgValue.includes("<path")
      ? svgValue.match(/d="([^"]+)"/)?.[1]
      : svgValue;

  if (!pathD) return "";

  const coordinates: [number, number][] = parseSvgPath(pathD);

  const result = coordinates
    .map(([x, y]) => `${Math.round(x)},${Math.round(y)}`)
    .join(" ");

  return result;
}

function parseFragmentSelector(value: string) {
  const [x1, y1, x2, y2] = value.split("=")[1].split(",").map(Number);
  return {
    ulx: x1,
    uly: y1,
    lrx: x1 + x2,
    lry: y1 + y2,
  };
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function formatResults(
  zonesByCanvas: Record<string, Zone[]>,
  canvasMapping: Record<string, { id: string; image: string }>
) {
  return Object.entries(zonesByCanvas)
    .filter(([, zones]) => zones.length > 0)
    .map(([canvasId, zones]) => ({
      canvas: canvasId,
      image: canvasMapping[canvasId].image,
      zones,
    }));
}

function parseSvgPath(pathD: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let currentX = 0;
  let currentY = 0;

  // スペースと改行を正規化し、コマンドと数値を分割
  const parts =
    pathD
      .replace(/\s+/g, " ")
      .trim()
      .match(/[A-Za-z]|-?\d*\.?\d+/g) || [];

  let i = 0;
  while (i < parts.length) {
    const cmd = parts[i];

    switch (cmd) {
      case "M":
      case "L":
        if (i + 2 < parts.length) {
          currentX = parseFloat(parts[i + 1]);
          currentY = parseFloat(parts[i + 2]);
          coordinates.push([currentX, currentY]);
          i += 3;
        } else {
          i++;
        }
        break;
      case "H":
        if (i + 1 < parts.length) {
          currentX = parseFloat(parts[i + 1]);
          coordinates.push([currentX, currentY]);
          i += 2;
        } else {
          i++;
        }
        break;
      case "V":
        if (i + 1 < parts.length) {
          currentY = parseFloat(parts[i + 1]);
          coordinates.push([currentX, currentY]);
          i += 2;
        } else {
          i++;
        }
        break;
      case "v":
        if (i + 1 < parts.length) {
          currentY += parseFloat(parts[i + 1]);
          coordinates.push([currentX, currentY]);
          i += 2;
        } else {
          i++;
        }
        break;
      case "h":
        if (i + 1 < parts.length) {
          currentX += parseFloat(parts[i + 1]);
          coordinates.push([currentX, currentY]);
          i += 2;
        } else {
          i++;
        }
        break;
      case "c":
        // 相対的なベジェ曲線の終点
        if (i + 6 < parts.length) {
          currentX += parseFloat(parts[i + 5]);
          currentY += parseFloat(parts[i + 6]);
          coordinates.push([currentX, currentY]);
          i += 7;
        } else {
          i++;
        }
        break;
      case "C":
        // 絶対的なベジェ曲線の終点
        if (i + 6 < parts.length) {
          currentX = parseFloat(parts[i + 5]);
          currentY = parseFloat(parts[i + 6]);
          coordinates.push([currentX, currentY]);
          i += 7;
        } else {
          i++;
        }
        break;
      case "Z":
      case "z":
        if (coordinates.length > 0) {
          coordinates.push([coordinates[0][0], coordinates[0][1]]);
        }
        i++;
        break;
      default:
        i++;
        break;
    }
  }

  return coordinates;
}
