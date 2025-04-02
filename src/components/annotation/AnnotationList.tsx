import type { AnnotationWithMultipleBodies } from "@/types/annotation";

interface AnnotationListProps {
  annotations: AnnotationWithMultipleBodies[];
  onDelete: (ids: string[]) => void;
  onSelect: (annotationId: string) => void;
  selectedId?: string;
}

const getAnnotationText = (annotation: AnnotationWithMultipleBodies) => {
  return annotation.body?.[0]?.value || "";
};

export function AnnotationList({
  annotations,
  onSelect,
  selectedId,
}: AnnotationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 
            border-b border-gray-200 dark:border-gray-700"
      >
        <p
          className="text-sm sm:text-base font-medium text-gray-900 
              dark:text-gray-100"
        >
          Annotations{" "}
          <span className="text-gray-500 dark:text-gray-400 font-normal">
            ({annotations.length})
          </span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            onClick={() => onSelect(annotation.id)}
            className={`
                  px-3 sm:px-4 py-2 sm:py-3 
                  border-b border-gray-200 dark:border-gray-700 
                  last:border-b-0 cursor-pointer
                  transition-colors duration-150 ease-in-out
              ${
                selectedId === annotation.id
                  ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100dark:hover:bg-blue-900/40"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }
            `}
          >
            <div
              className="text-sm sm:text-base text-gray-600 dark:text-gray-300"
              dangerouslySetInnerHTML={{
                __html: getAnnotationText(annotation),
              }}
            />
          </div>
        ))}
        {annotations.length === 0 && (
          <div
            className="px-3 sm:px-4 py-4 text-center text-gray-500 
            dark:text-gray-400 text-sm"
          >
            アノテーションがありません
          </div>
        )}
      </div>
    </div>
  );
}
