import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

/** Firestore用のアノテーションアダプター */
export default class FirestoreAnnotationAdapter {
  static firestore = null;

  /** Firebase初期化 */
  static initialize() {
    if (getApps().length === 0) {
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      };

      const app = initializeApp(firebaseConfig);
      this.firestore = getFirestore(app);
    } else {
      this.firestore = getFirestore();
    }
    return this.firestore;
  }

  /** */
  constructor(canvasId, manifestId) {
    if (!FirestoreAnnotationAdapter.firestore) {
      FirestoreAnnotationAdapter.initialize();
    }

    this.canvasId = canvasId;
    this.manifestId = manifestId;

    this.collectionRef = collection(
      FirestoreAnnotationAdapter.firestore,
      "annotations"
    );
  }

  /** */
  get annotationPageId() {
    return `${this.canvasId}/annotations`;
  }

  /** */
  async create(annotation) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      window.alert("ログインが必要です");
      return null;
    }

    const docRef = doc(this.collectionRef);
    const annotationData = {
      ...annotation,
      canvasId: this.canvasId,
      created: new Date(),
      id: docRef.id,
      manifestId: this.manifestId,
      modified: new Date(),
      userId: user.uid,
      userName: user.displayName,
    };

    await setDoc(docRef, annotationData);
    return this.all();
  }

  /** */
  async update(annotation) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      window.alert("ログインが必要です");
      return null;
    }

    const docRef = doc(this.collectionRef, annotation.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("アノテーションが見つかりません");
    }

    const existingData = docSnap.data();

    if (existingData.userId !== user.uid) {
      throw new Error("このアノテーションを編集する権限がありません");
    }

    const annotationData = {
      ...annotation,
      manifestId: this.manifestId,
      // Preserve the original created timestamp, or set it now if it doesn't exist
      created: existingData.created || new Date(),
      modified: new Date(),
    };

    await updateDoc(docRef, annotationData);
    return this.all();
  }

  /** */
  async delete(annoId) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      window.alert("ログインが必要です");
      return null;
    }

    const docRef = doc(this.collectionRef, annoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("アノテーションが見つかりません");
    }

    if (docSnap.data().userId !== user.uid) {
      throw new Error("このアノテーションを削除する権限がありません");
    }

    await deleteDoc(docRef);
    return this.all();
  }

  /** */
  async get(annoId) {
    const docSnap = await getDoc(doc(this.collectionRef, annoId));
    return docSnap.exists() ? docSnap.data() : null;
  }

  /** Returns an AnnotationPage with all annotations */
  async all() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      return {
        id: this.annotationPageId,
        items: [],
        type: "AnnotationPage",
      };
    }

    const q = query(
      this.collectionRef,
      where("canvasId", "==", this.canvasId),
      where("manifestId", "==", this.manifestId),
      where("userId", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);
    const annotations = querySnapshot.docs.map((snapshot) => {
      const data = snapshot.data();

      // Helper function to convert timestamp to serializable format
      const convertTimestamp = (timestamp) => {
        if (!timestamp) return undefined;

        // If it's a Firestore Timestamp (check for toDate method)
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
          const date = timestamp.toDate();
          return {
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000,
            type: "firestore/timestamp/1.0"
          };
        }

        // If it's a Firestore Timestamp with seconds property
        if (timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
          return {
            seconds: timestamp.seconds,
            nanoseconds: timestamp.nanoseconds,
            type: "firestore/timestamp/1.0"
          };
        }

        // If it's a JavaScript Date object
        if (timestamp instanceof Date) {
          return {
            seconds: Math.floor(timestamp.getTime() / 1000),
            nanoseconds: (timestamp.getTime() % 1000) * 1000000,
            type: "firestore/timestamp/1.0"
          };
        }

        return undefined;
      };

      // Convert Firestore Timestamps to serializable format
      return {
        ...data,
        created: convertTimestamp(data.created),
        modified: convertTimestamp(data.modified),
      };
    });

    return {
      id: this.annotationPageId,
      items: annotations,
      type: "AnnotationPage",
    };
  }

  /** Returns an AnnotationPage with all annotations */
  async export() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      return {
        // id: this.annotationPageId,
        items: [],
        type: "AnnotationPage",
      };
    }

    const q = query(
      this.collectionRef,
      // where("canvasId", "==", this.canvasId),
      where("manifestId", "==", this.manifestId),
      where("userId", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);
    const annotations = querySnapshot.docs.map((snapshot) => snapshot.data());

    return {
      // id: this.annotationPageId,
      items: annotations,
      type: "AnnotationPage",
    };
  }
}
