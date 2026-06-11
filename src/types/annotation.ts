import { Timestamp } from "firebase/firestore";

// ラベル(本文テキスト)以外の追加メタデータ。項目名(label)と値(value)の
// key-value ペアを複数持てる。下流(kojima アーカイブ)で全文検索＋ファセット化される。
export interface MetadataField {
  label: string;
  value: string;
}

export interface Annotation {
  id: string;
  created?: Timestamp;
  modified?: Timestamp;
  motivation: string;
  type: string;
  manifestId?: string;
  canvasId?: string;
  metadata?: MetadataField[];
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
