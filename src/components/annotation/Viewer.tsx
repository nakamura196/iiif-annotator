import dynamic from "next/dynamic";
import { W3CImageFormat } from "@annotorious/annotorious";

const DynamicOpenSeadragonAnnotator = dynamic(
  () => import("@annotorious/react").then((mod) => mod.OpenSeadragonAnnotator),
  { ssr: false }
);

const DynamicOpenSeadragonViewer = dynamic(
  () => import("@annotorious/react").then((mod) => mod.OpenSeadragonViewer),
  { ssr: false }
);

interface ViewerProps {
  tool: "rectangle" | "polygon" | undefined;
  infoUrls: string[];
  options: OpenSeadragon.Options;
}

// infoUrls,
export function Viewer({ tool, options }: ViewerProps) {
  return (
    <div className="flex-1 relative">
      <DynamicOpenSeadragonAnnotator
        drawingEnabled={tool !== undefined}
        tool={tool || "rectangle"}
        adapter={W3CImageFormat("")}
      >
        <DynamicOpenSeadragonViewer
          className="absolute inset-0"
          options={options}
        />
      </DynamicOpenSeadragonAnnotator>
    </div>
  );
}
