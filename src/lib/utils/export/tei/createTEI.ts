import type { AnnotationWidthSingleBody } from "@/types/annotation";
import xmlFormat from "xml-formatter";
import { createMappings } from "./parseSvgPath";
import {
  createSurfaceElement,
  createTeiDocument,
} from "./createSurfaceElement";

export async function createTEI(
  annotations: AnnotationWidthSingleBody[]
): Promise<string> {
  const [manifestId, results] = await createMappings(annotations);
  if (!manifestId) return "";

  const doc = createTeiDocument(manifestId);
  const facsimile = doc.querySelector("facsimile");

  for (const result of results) {
    const surface = createSurfaceElement(doc, result);
    facsimile?.appendChild(surface);
  }

  return xmlFormat(new XMLSerializer().serializeToString(doc));
}
