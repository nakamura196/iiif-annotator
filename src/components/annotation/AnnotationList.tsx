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
      <div className="px-4 py-3 bg-gray-50 border-b sticky top-0 z-10">
        <p className="text-sm font-medium text-gray-900">
          Annotations{" "}
          <span className="text-gray-500 font-normal">
            ({annotations.length})
          </span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {annotations?.map((annotation) => (
          <div
            key={annotation.id}
            onClick={() => onSelect(annotation.id)}
            className={`
              px-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer
              transition-colors duration-150 ease-in-out
              ${
                selectedId === annotation.id
                  ? "bg-blue-50 hover:bg-blue-100"
                  : "hover:bg-gray-50"
              }
            `}
          >
            <div
              className="text-sm text-gray-600"
              dangerouslySetInnerHTML={{
                __html: getAnnotationText(annotation),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
