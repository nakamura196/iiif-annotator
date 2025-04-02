import { Timestamp } from "firebase/firestore";

export interface Annotation {
  id: string;
  created?: Timestamp;
  modified?: Timestamp;
  motivation: string;
  type: string;
  /*
    body:
      | {
          type: string;
          value: string;
        }
      | {
          type: string;
          value: string;
        }[];
      */

  target: {
    selector: {
      type: string;
      value: string;
    }[];
    source: {
      id: string;
      partOf: {
        id: string;
        type: string;
      };
      type: string;
    };
  };
}

// IIIFアノテーションの型
export interface AnnotationWidthSingleBody extends Annotation {
  body: {
    type: string;
    value: string;
  }; // []; // []
}

export interface AnnotationWithMultipleBodies extends Annotation {
  body: {
    type: string;
    value: string;
  }[]; // []
}
