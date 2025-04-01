import { Move, Square, TriangleRight } from "lucide-react";

interface ToolBarProps {
  tool: "rectangle" | "polygon" | undefined;
  setTool: (tool: "rectangle" | "polygon" | undefined) => void;
}

export function ToolBar({ tool, setTool }: ToolBarProps) {
  return (
    <div className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-50 border-b">
      <div className="flex flex-wrap gap-2">
        <button
          className={`
            px-2 sm:px-3 py-1 sm:py-2 rounded-md text-xs sm:text-sm font-medium
            transition-colors duration-150 ease-in-out
            cursor-pointer
            flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            ${
              tool === undefined
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }
          `}
          onClick={() => setTool(undefined)}
        >
          <Move className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Move
        </button>
        <button
          className={`
            px-2 sm:px-3 py-1 sm:py-2 rounded-md text-xs sm:text-sm font-medium
            transition-colors duration-150 ease-in-out
            cursor-pointer
            flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            ${
              tool === "rectangle"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }
          `}
          onClick={() => setTool("rectangle")}
        >
          <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Rectangle
        </button>
        <button
          className={`
            px-2 sm:px-3 py-1 sm:py-2 rounded-md text-xs sm:text-sm font-medium
            transition-colors duration-150 ease-in-out
            cursor-pointer
            flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            ${
              tool === "polygon"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }
          `}
          onClick={() => setTool("polygon")}
        >
          <TriangleRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{" "}
          Polygon
        </button>
      </div>
    </div>
  );
}
