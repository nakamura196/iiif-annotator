import { Zone } from "@/types/zone";

interface SurfaceData {
  canvas: string;
  image: string;
  zones: Zone[];
}

export function createTeiDocument(manifestId: string): Document {
  const template = `<?xml version="1.0" encoding="utf-8"?>
  <?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
  <?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml"
      schematypens="http://purl.oclc.org/dsdl/schematron"?>
  <TEI xmlns="http://www.tei-c.org/ns/1.0">
   <teiHeader>
    <fileDesc>
     <titleStmt>
      <title>
       Title
      </title>
     </titleStmt>
     <publicationStmt>
      <p>
       Publication Information
      </p>
     </publicationStmt>
     <sourceDesc>
      <p>
       Information about the source
      </p>
     </sourceDesc>
    </fileDesc>
   </teiHeader>
   <text>
    <body>
     <p>
      Some text here.
     </p>
    </body>
   </text>
   <facsimile>
   </facsimile>
  </TEI>`;
  const doc = new DOMParser().parseFromString(template, "text/xml");
  const facsimile = doc.querySelector("facsimile");
  facsimile?.setAttribute("sameAs", manifestId);
  return doc;
}

export function createSurfaceElement(
  doc: Document,
  data: SurfaceData
): Element {
  const surface = doc.createElementNS("http://www.tei-c.org/ns/1.0", "surface");
  surface.setAttribute("sameAs", data.canvas);

  const graphic = doc.createElementNS("http://www.tei-c.org/ns/1.0", "graphic");
  graphic.setAttribute("url", data.image + "/full/full/0/default.jpg");
  graphic.setAttribute("sameAs", data.image);
  surface.appendChild(graphic);

  for (const item of data.zones) {
    const zone = createZoneElement(doc, item);
    surface.appendChild(zone);
  }

  return surface;
}

function createZoneElement(doc: Document, zone: Zone): Element {
  const element = doc.createElementNS("http://www.tei-c.org/ns/1.0", "zone");
  element.setAttribute("ulx", zone.ulx.toString());
  element.setAttribute("uly", zone.uly.toString());
  element.setAttribute("lrx", zone.lrx.toString());
  element.setAttribute("lry", zone.lry.toString());
  element.setAttribute("ana", zone.ana);
  if (zone.points) {
    element.setAttribute("points", zone.points);
  }
  return element;
}
