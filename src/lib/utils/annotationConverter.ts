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
    .map((annotation) => {
      try {
        if (!annotation.target.selector) {
          return null;
        }
        
        // Filter out annotations with zero-sized bounding boxes
        const selectorText = JSON.stringify(annotation.target.selector);
        if (selectorText.includes("xywh=0,0,0,0")) {
          return null;
        }
        
        // Validate and clean selectors
        const selectorsList = Array.isArray(annotation.target.selector) 
          ? annotation.target.selector 
          : [annotation.target.selector];
        
        // Create cleaned selectors array
        const cleanedSelectors = [];
        let hasValidSelector = false;
        
        for (const selector of selectorsList) {
          if (!selector || !selector.type) continue;
          
          if (selector.type === "FragmentSelector") {
            // Validate FragmentSelector
            if (selector.value && selector.value.includes("xywh=")) {
              // Check if it's not a zero-sized box
              const xywhMatch = selector.value.match(/xywh=([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);
              if (xywhMatch) {
                const [, , , w, h] = xywhMatch;
                if (parseFloat(w) > 0 && parseFloat(h) > 0) {
                  cleanedSelectors.push(selector);
                  hasValidSelector = true;
                }
              }
            }
          } else if (selector.type === "SvgSelector" && selector.value) {
            // Validate SVG content
            const svgValue = selector.value;
            
            // Check for valid path element
            if (svgValue.includes('<path')) {
              const pathMatch = svgValue.match(/d="([^"]*)"/);
              if (pathMatch && pathMatch[1] && pathMatch[1].trim().length > 0) {
                // Convert relative commands to absolute if needed
                const convertedSvg = convertPathToAbsolute(svgValue);
                // Validate the converted path
                const convertedMatch = convertedSvg.match(/d="([^"]*)"/);
                if (convertedMatch && convertedMatch[1] && convertedMatch[1].trim().length > 0) {
                  // Check that path contains valid commands
                  const pathCommands = convertedMatch[1];
                  if (pathCommands.match(/M\s*[\d.-]+[\s,]+[\d.-]+/)) {
                    // Has at least a valid move command
                    cleanedSelectors.push({
                      type: "SvgSelector",
                      value: convertedSvg
                    });
                    hasValidSelector = true;
                  }
                }
              }
            }
            // Check for valid polygon element
            else if (svgValue.includes('<polygon')) {
              const pointsMatch = svgValue.match(/points="([^"]*)"/);
              if (pointsMatch && pointsMatch[1] && pointsMatch[1].trim().length > 0) {
                // Convert polygon to path for better compatibility
                const convertedSvg = convertPolygonToPath(svgValue);
                cleanedSelectors.push({
                  type: "SvgSelector",
                  value: convertedSvg
                });
                hasValidSelector = true;
              }
            }
            // If it's a valid SVG without path or polygon, keep it
            else if (svgValue.includes('<svg') && svgValue.includes('</svg>')) {
              cleanedSelectors.push(selector);
              hasValidSelector = true;
            }
          } else {
            // Keep other selector types
            cleanedSelectors.push(selector);
          }
        }
        
        // Skip if no valid selectors found
        if (!hasValidSelector || cleanedSelectors.length === 0) {
          return null;
        }
        
        // Final validation: ensure we have at least one FragmentSelector
        // Annotorious requires at least a bounding box to render
        const hasFragmentSelector = cleanedSelectors.some(s => s.type === "FragmentSelector");
        if (!hasFragmentSelector) {
          // Try to create a fragment selector from SVG if possible
          const svgSelector = cleanedSelectors.find(s => s.type === "SvgSelector");
          if (svgSelector && svgSelector.value) {
            const bbox = extractBoundingBoxFromSvg(svgSelector.value);
            if (bbox) {
              cleanedSelectors.push({
                type: "FragmentSelector",
                value: `xywh=${bbox.x},${bbox.y},${bbox.w},${bbox.h}`
              });
            } else {
              // Can't determine bounding box, skip this annotation
              return null;
            }
          } else {
            // No way to determine position, skip
            return null;
          }
        }
        
        // Return cleaned annotation
        const result: AnnotationWidthSingleBody = {
          id: annotation.id,
          motivation: annotation.motivation,
          type: annotation.type,
          body: {
            type: annotation.body.type,
            value: annotation.body.value || "",
          },
          target: {
            selector: cleanedSelectors.reverse(), // Reverse for Annotorious compatibility
            source: annotation.target.source,
          },
        };
        return result as unknown as ImageAnnotation;
      } catch {
        // Failed to convert annotation
        return null;
      }
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

// Extract bounding box from SVG path
const extractBoundingBoxFromSvg = (svg: string): { x: number; y: number; w: number; h: number } | null => {
  try {
    const pathMatch = svg.match(/d="([^"]*)"/);
    if (!pathMatch || !pathMatch[1]) return null;
    
    const pathData = pathMatch[1];
    const coords: { x: number; y: number }[] = [];
    
    // Extract all coordinate pairs from the path
    const matches = pathData.matchAll(/[\d.-]+[\s,]+[\d.-]+/g);
    for (const match of matches) {
      const [x, y] = match[0].split(/[\s,]+/).map(Number);
      if (!isNaN(x) && !isNaN(y)) {
        coords.push({ x, y });
      }
    }
    
    if (coords.length === 0) return null;
    
    // Calculate bounding box
    const xValues = coords.map(c => c.x);
    const yValues = coords.map(c => c.y);
    const minX = Math.min(...xValues);
    const minY = Math.min(...yValues);
    const maxX = Math.max(...xValues);
    const maxY = Math.max(...yValues);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) return null;
    
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(width),
      h: Math.round(height)
    };
  } catch {
    return null;
  }
};

// Convert relative path commands to absolute commands
const convertPathToAbsolute = (svg: string) => {
  try {
    // Fix missing xmlns attribute first
    if (!svg.includes('xmlns=') && svg.includes('<svg')) {
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const pathMatch = svg.match(/d="([^"]*)"/);
    if (!pathMatch || !pathMatch[1]) return svg;
    
    const pathData = pathMatch[1];
    
    // Convert relative commands (v, h) to absolute (L)
    // This is a simplified conversion that handles basic rectangles
    if (pathData.includes('v') || pathData.includes('h')) {
      // Parse the M command to get starting position
      const mMatch = pathData.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
      if (!mMatch) return svg;
      
      let currentX = parseFloat(mMatch[1]);
      let currentY = parseFloat(mMatch[2]);
      const startX = currentX;
      const startY = currentY;
      
      // Build new path with absolute commands
      let newPath = `M ${currentX} ${currentY}`;
      
      // Split the path into commands
      const commands = pathData.substring(mMatch[0].length).match(/[vhVHlLmMzZ][^vhVHlLmMzZ]*/g);
      
      if (commands) {
        for (const cmd of commands) {
          const type = cmd[0];
          const values = cmd.substring(1).trim();
          
          if (type === 'v') {
            // Vertical relative
            const dy = parseFloat(values);
            currentY += dy;
            newPath += ` L ${currentX} ${currentY}`;
          } else if (type === 'h') {
            // Horizontal relative
            const dx = parseFloat(values);
            currentX += dx;
            newPath += ` L ${currentX} ${currentY}`;
          } else if (type === 'V') {
            // Vertical absolute
            currentY = parseFloat(values);
            newPath += ` L ${currentX} ${currentY}`;
          } else if (type === 'H') {
            // Horizontal absolute
            currentX = parseFloat(values);
            newPath += ` L ${currentX} ${currentY}`;
          } else if (type === 'L') {
            // Line absolute
            const coords = values.split(/[,\s]+/);
            if (coords.length >= 2) {
              currentX = parseFloat(coords[0]);
              currentY = parseFloat(coords[1]);
              newPath += ` L ${currentX} ${currentY}`;
            }
          } else if (type === 'l') {
            // Line relative
            const coords = values.split(/[,\s]+/);
            if (coords.length >= 2) {
              currentX += parseFloat(coords[0]);
              currentY += parseFloat(coords[1]);
              newPath += ` L ${currentX} ${currentY}`;
            }
          } else if (type === 'z' || type === 'Z') {
            // Close path
            newPath += ' Z';
            currentX = startX;
            currentY = startY;
          }
        }
      }
      
      return svg.replace(/d="[^"]*"/, `d="${newPath}"`);
    }
    
    return svg;
  } catch {
    return svg;
  }
};

const convertPolygonToPath = (svg: string) => {
  try {
    // Fix missing xmlns attribute
    if (!svg.includes('xmlns=') && svg.includes('<svg')) {
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // polygonのpoints属性を抽出
    const polygonMatch = svg.match(/<polygon points="([^"]+)"/);
    if (!polygonMatch) {
      // Check if it's already a path and needs conversion from relative to absolute
      if (svg.includes('<path')) {
        return convertPathToAbsolute(svg);
      }
      return svg;
    }

    const pointsStr = polygonMatch[1].trim();
    
    // Empty points attribute check
    if (!pointsStr) {
      // Return SVG with empty path to avoid parser errors
      return svg.replace(/<polygon points="[^"]*"/, '<path d="M 0 0"');
    }

    // スペースで区切られたpoint pairs (x,y)を分割
    const pointPairs = pointsStr.split(/\s+/).filter(pair => pair.length > 0);
    
    // Build valid coordinates array
    const validCoords: { x: number; y: number }[] = [];
    
    for (const pair of pointPairs) {
      const coords = pair.split(",");
      if (coords.length !== 2) continue; // Skip invalid pairs
      
      const [x, y] = coords.map(Number);
      if (isNaN(x) || isNaN(y)) continue; // Skip invalid numbers
      
      validCoords.push({ x, y });
    }
    
    // If no valid coordinates, return empty path
    if (validCoords.length === 0) {
      return svg.replace(/<polygon points="[^"]*"/, '<path d="M 0 0"');
    }

    // pathのd属性を構築 - always use spaces for consistency
    let pathD = "";
    
    validCoords.forEach((coord, index) => {
      // 最初のポイントはMoveToコマンド、それ以降はLineToコマンド
      if (index === 0) {
        pathD += `M ${coord.x} ${coord.y}`;
      } else {
        pathD += ` L ${coord.x} ${coord.y}`;
      }
    });

    // ポリゴンを閉じる
    pathD += " Z";

    // 元のSVGからpolygon要素をpath要素に置き換える
    const newSvg = svg.replace(/<polygon points="[^"]*"/, `<path d="${pathD}"`);

    return newSvg;
  } catch {
    // Failed to convert polygon to path
    return svg; // Return original on error
  }
};

const convertToXywh = (svg: string) => {
  try {
    const polygonMatch = svg.match(/<polygon points="([^"]+)"/);
    if (!polygonMatch) {
      // Try to extract from path element if polygon not found
      const pathMatch = svg.match(/<path[^>]*d="([^"]+)"/);
      if (!pathMatch) {
        throw new Error("Neither polygon nor path found in SVG");
      }
      // For now, return a default bounding box for paths
      // This could be improved to parse path commands
      return { x: 0, y: 0, w: 100, h: 100 };
    }

    // Split into pairs, then extract individual coordinates
    const pointPairs = polygonMatch[1].split(/\s+/).filter(pair => pair.length > 0);
    const coordinates = pointPairs.map((pair) => {
      const coords = pair.split(",");
      if (coords.length !== 2) return null;
      const [x, y] = coords.map(Number);
      if (isNaN(x) || isNaN(y)) return null;
      return { x, y };
    }).filter(coord => coord !== null) as { x: number; y: number }[];

    if (coordinates.length === 0) {
      throw new Error("No valid coordinates found");
    }

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
  } catch {
    // Failed to convert SVG to xywh
    // Return a default bounding box on error
    return { x: 0, y: 0, w: 100, h: 100 };
  }
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
  
  // Check for invalid values
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    // Return minimal valid SVG to avoid parser errors
    return `<svg xmlns='http://www.w3.org/2000/svg'><path xmlns="http://www.w3.org/2000/svg" d="M 0 0"></svg>`;
  }
  
  // Skip if width or height is 0 or negative
  if (width <= 0 || height <= 0) {
    // Return minimal valid SVG to avoid parser errors
    return `<svg xmlns='http://www.w3.org/2000/svg'><path xmlns="http://www.w3.org/2000/svg" d="M ${x} ${y}"></svg>`;
  }

  // 小数点以下5桁まで丸める（必要に応じて調整可能）
  const xFormatted = x.toFixed(5);
  const bottomFormatted = (y + height).toFixed(5);

  // 矩形のpathを生成（時計回りに定義）
  // M x,y → 左上から開始
  // L → 絶対座標で線を引く
  // Z → パスを閉じる
  const topY = y.toFixed(5);
  const rightX = (x + width).toFixed(5);
  const pathD = `M ${xFormatted},${bottomFormatted} L ${xFormatted},${topY} L ${rightX},${topY} L ${rightX},${bottomFormatted} Z`;

  // SVG文字列を生成 (add spaces after M and L for better compatibility)
  const svgString = `<svg xmlns='http://www.w3.org/2000/svg'><path xmlns="http://www.w3.org/2000/svg" d="${pathD}"></svg>`;

  return svgString;
}

const convertSelector = (selector: { type: string; value: string }) => {
  const selectors: {
    type: string;
    value: string;
  }[] = [];

  try {
    if (selector.type === "FragmentSelector") {
      const value = selector.value.replace("pixel:", "");
      selectors.push({
        type: "FragmentSelector",
        value: value,
      });
      
      try {
        selectors.push({
          type: "SvgSelector",
          value: xywhToSvgPath(value),
        });
      } catch {
        // Failed to convert xywh to SVG path
      }
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
  } catch {
    // Failed to convert selector
    // Return at least the original selector
    selectors.push(selector);
  }

  return selectors;
};
