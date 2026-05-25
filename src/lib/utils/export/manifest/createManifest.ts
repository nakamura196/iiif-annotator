import { AnnotationWidthSingleBody } from "@/types/annotation";
import { convertPresentation2 } from "@iiif/parser/presentation-2";

export const createManifest = async (
  annotations: AnnotationWidthSingleBody[]
) => {
  if (annotations.length === 0) {
    return "{}";
  }

  const manifestUri = annotations[0].manifestId || "";

  const r = await fetch(manifestUri);
  let manifestData = await r.json();

  const context = manifestData["@context"];

  if (
    context.indexOf("http://iiif.io/api/presentation/2/context.json") !== -1
  ) {
    manifestData = await convertPresentation2(manifestData);
  }

  const canvases = manifestData.items;

  for (const canvas of canvases) {
    const canvasId = canvas.id;

    const canvasAnnotations = annotations.filter(
      (annotation) => annotation.canvasId === canvasId
    );

    canvas.annotations = [
      {
        id: canvasId + "/annotations",
        type: "AnnotationPage",
        items: canvasAnnotations.map((annotation) => {
          return {
            id: canvasId + "/annotations/" + annotation.id,
            type: "Annotation",
            motivation: annotation.motivation,
            body: annotation.body,
            target: annotation.target,
          };
        }),
      },
    ];
  }

  return JSON.stringify(manifestData, null, 2);
};
