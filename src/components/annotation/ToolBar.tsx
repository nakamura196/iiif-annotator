import { Move, Square, TriangleRight } from "lucide-react";

interface ToolBarProps {
  tool: "rectangle" | "polygon" | undefined;
  setTool: (tool: "rectangle" | "polygon" | undefined) => void;
}

export function ToolBar({ tool, setTool }: ToolBarProps) {
  return (
    <div
      className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 
      border-b border-gray-200 dark:border-gray-700"
    >
      <div className="flex flex-wrap gap-2">
        <button
          className={`
            px-2 sm:px-3 py-1 sm:py-2 rounded-md text-xs sm:text-sm font-medium
            transition-colors duration-150 ease-in-out
            cursor-pointer flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              tool === undefined
                ? `bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 
                   dark:hover:bg-blue-600 focus:ring-blue-500 
                   dark:focus:ring-blue-400`
                : `bg-white dark:bg-gray-700 border border-gray-200 
                   dark:border-gray-600 text-gray-700 dark:text-gray-200 
                   hover:bg-gray-50 dark:hover:bg-gray-600 
                   focus:ring-gray-500 dark:focus:ring-gray-400`
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
            cursor-pointer flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              tool === "rectangle"
                ? `bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 
                   dark:hover:bg-blue-600 focus:ring-blue-500 
                   dark:focus:ring-blue-400`
                : `bg-white dark:bg-gray-700 border border-gray-200 
                   dark:border-gray-600 text-gray-700 dark:text-gray-200 
                   hover:bg-gray-50 dark:hover:bg-gray-600 
                   focus:ring-gray-500 dark:focus:ring-gray-400`
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
            cursor-pointer flex items-center
            min-w-[80px] sm:min-w-[100px] justify-center
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              tool === "polygon"
                ? `bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 
                   dark:hover:bg-blue-600 focus:ring-blue-500 
                   dark:focus:ring-blue-400`
                : `bg-white dark:bg-gray-700 border border-gray-200 
                   dark:border-gray-600 text-gray-700 dark:text-gray-200 
                   hover:bg-gray-50 dark:hover:bg-gray-600 
                   focus:ring-gray-500 dark:focus:ring-gray-400`
            }
          `}
          onClick={() => setTool("polygon")}
        >
          <TriangleRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Polygon
        </button>
      </div>
    </div>
  );
}
