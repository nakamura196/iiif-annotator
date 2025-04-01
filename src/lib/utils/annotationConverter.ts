import {
  AnnotationWidthSingleBody,
  AnnotationWithMultipleBodies,
} from "@/types/annotation";
import { ImageAnnotation } from "@annotorious/annotorious";

// 複数のアノテーションを一括変換するヘルパー関数
export function convertMultipleAnnotations(
  annotationsArray: AnnotationWidthSingleBody[]
): ImageAnnotation[] {
  return annotationsArray
    .map((selectors) => {
      if (!selectors.target.selector) {
        return null;
      }
      const selectorText = JSON.stringify(selectors.target.selector);
      if (selectorText.includes("xywh=0,0,0,0")) {
        return null;
      }
      const result: AnnotationWidthSingleBody = {
        id: selectors.id,
        motivation: selectors.motivation,
        type: selectors.type,
        body: {
          type: selectors.body.type,
          value: selectors.body.value || "",
        },
        target: {
          selector: selectors.target.selector.reverse(),
          source: selectors.target.source,
        },
      };
      return result as unknown as ImageAnnotation;
    })
    .filter((annotation) => annotation !== null);
}

/* ImageAnnotation | */
export function convertAnnotoriousToIIIF(
  annotation: ImageAnnotation,
  infoUrl: string,
  manifestUrl: string
) {
  const iiifAnnotation: AnnotationWidthSingleBody = {
    id: annotation.id,
    motivation: "commenting",
    type: "Annotation",
    body: {
      type: "TextualBody",
      value:
        (annotation as unknown as AnnotationWithMultipleBodies).body?.[0]
          ?.value || "",
    },
    target: convertTarget(annotation.target, infoUrl, manifestUrl),
  };

  return iiifAnnotation;
}

const convertTarget = (
  target: ImageAnnotation["target"],
  infoUrl: string,
  manifestUrl: string
) => {
  return {
    selector: convertSelector(
      target.selector as unknown as {
        type: string;
        value: string;
      }
    ),
    source: {
      id: infoUrl,
      partOf: {
        id: manifestUrl,
        type: "Manifest",
      },
      type: "Canvas",
    },
  };
};

const convertPolygonToPath = (svg: string) => {
  // polygonのpoints属性を抽出
  const polygonMatch = svg.match(/<polygon points="([^"]+)"/);
  if (!polygonMatch) throw new Error("Polygon not found");

  const pointsStr = polygonMatch[1];

  // スペースで区切られたpoint pairs (x,y)を分割
  const pointPairs = pointsStr.split(" ");

  // pathのd属性を構築
  let pathD = "";

  pointPairs.forEach((pair: string, index: number) => {
    const [x, y] = pair.split(",").map(Number);

    // 最初のポイントはMoveToコマンド、それ以降はLineToコマンド
    if (index === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  // ポリゴンを閉じる
  pathD += " Z";

  // 元のSVGからpolygon要素をpath要素に置き換える
  const newSvg = svg.replace(/<polygon points="[^"]+"/, `<path d="${pathD}"`);

  return newSvg;
};

const convertToXywh = (svg: string) => {
  const polygonMatch = svg.match(/<polygon points="([^"]+)"/);
  if (!polygonMatch) throw new Error("Polygon not found");

  // Split into pairs, then extract individual coordinates
  const pointPairs = polygonMatch[1].split(" ");
  const coordinates = pointPairs.map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });

  // Extract min/max values
  const xValues = coordinates.map((coord) => coord.x);
  const yValues = coordinates.map((coord) => coord.y);

  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  // Calculate width and height
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    x: parseInt(minX.toString()),
    y: parseInt(minY.toString()),
    w: parseInt(width.toString()),
    h: parseInt(height.toString()),
  };
};

/**
 * xywh形式の文字列からSVGのpath要素を含むSVG文字列を生成する関数
 * @param {string} xywhStr - "xywh=x,y,width,height" 形式の文字列
 * @returns {string} - path要素を含むSVG文字列
 */
function xywhToSvgPath(xywhStr: string) {
  // xywh文字列からx,y,width,heightを抽出
  const match = xywhStr.match(/xywh=([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);

  if (!match) {
    throw new Error('Invalid xywh format. Expected "xywh=x,y,width,height"');
  }

  // 数値に変換
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const width = parseFloat(match[3]);
  const height = parseFloat(match[4]);

  // 小数点以下5桁まで丸める（必要に応じて調整可能）
  const xFormatted = x.toFixed(5);
  const bottomFormatted = (y + height).toFixed(5);

  // 矩形のpathを生成（時計回りに定義）
  // M x,y → 左上から開始
  // v height → 下に移動
  // h width → 右に移動
  // v -height → 上に移動
  // z → パスを閉じる
  const pathD = `M${xFormatted},${bottomFormatted}v-${height.toFixed(
    5
  )}h${width.toFixed(5)}v${height.toFixed(5)}z`;

  // SVG文字列を生成
  const svgString = `<svg xmlns='http://www.w3.org/2000/svg'><path xmlns="http://www.w3.org/2000/svg" d="${pathD}"></svg>`;

  return svgString;
}

const convertSelector = (selector: { type: string; value: string }) => {
  const selectors: {
    type: string;
    value: string;
  }[] = [];

  if (selector.type === "FragmentSelector") {
    const value = selector.value.replace("pixel:", "");
    selectors.push({
      type: "FragmentSelector",
      value: value,
    });
    selectors.push({
      type: "SvgSelector",
      value: xywhToSvgPath(value),
    });
  } else if (selector.type === "SvgSelector") {
    const { x, y, w, h } = convertToXywh(selector.value);

    selectors.push({
      type: "FragmentSelector",
      value: `xywh=${x},${y},${w},${h}`,
    });

    selectors.push({
      type: "SvgSelector",
      value: convertPolygonToPath(selector.value),
    });
  }

  return selectors;
};
