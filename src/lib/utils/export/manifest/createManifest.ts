import { AnnotationWidthSingleBody } from "@/types/annotation";
import { convertPresentation2 } from "@iiif/parser/presentation-2";

export const createManifest = async (
  annotations: AnnotationWidthSingleBody[]
) => {
  if (annotations.length === 0) {
    return null;
  }

  const firstAnnotation = annotations[0];

  console.log({ firstAnnotation });

  const manifestUri = annotations[0].manifestId || "";

  console.log({ manifestUri });

  const r = await fetch(manifestUri);
  let manifestData = await r.json();

  console.log({ manifestData });

  const context = manifestData["@context"];

  if (
    context.indexOf("http://iiif.io/api/presentation/2/context.json") !== -1
  ) {
    manifestData = await convertPresentation2(manifestData);
  }

  const canvases = manifestData.items;

  for (const canvas of canvases) {
    const canvasId = canvas.id;
    // const canvasData = await fetch(canvasId).then((res) => res.json());
    // console.log({ canvasData });

    const canvasAnnotations = annotations.filter(
      (annotation) => annotation.canvasId === canvasId
    );

    canvas.annotations = [
      {
        id: "",
        type: "AnnotationPage",
        items: canvasAnnotations.map((annotation) => {
          return {
            id: annotation.id,
            type: "Annotation",
            motivation: annotation.motivation,
            body: annotation.body,
            target: annotation.target,
          };
        }),
      },
    ];

    console.log({ canvasAnnotations });
  }

  return JSON.stringify(manifestData, null, 2);
};
