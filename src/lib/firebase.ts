import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, persistentLocalCache, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBvu1DQDq1Bc10-sgxjspt3EEJ-tEMskHM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "spokbee-agents.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "spokbee-agents",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "spokbee-agents.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "289955521641",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:289955521641:web:dcb4116961c98df869aef8"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export interface Book {
  id: number;
  firestoreId?: string;
  title: string;
  author: string;
  pageCount: number | null;
  capturedImage: string | null;
  coverUrl: string | null;
  timestamp: number;
}

export const saveBook = async (book: Book) => {
  try {
    const docRef = await addDoc(collection(db, "books"), book);
    return { ...book, firestoreId: docRef.id };
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const getBooks = async () => {
  try {
    const q = query(collection(db, "books"), orderBy("timestamp", "desc"));
    // Race against 8 seconds timeout
    const querySnapshot = await Promise.race([
      getDocs(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore connection timed out after 8 seconds. This might be an adblocker or a caching issue on your device.")), 8000))
    ]) as any;
    const books: Book[] = [];
    querySnapshot.forEach((doc: any) => {
      books.push({ ...(doc.data() as Book), firestoreId: doc.id });
    });
    return books;
  } catch (e: any) {
    console.error("Error getting documents: ", e);
    // Let's pass the error up so the UI can alert it
    throw new Error("Firestore Fetch Error: " + (e.message || String(e)));
  }
};

export const removeBook = async (firestoreId: string) => {
  try {
    await deleteDoc(doc(db, "books", firestoreId));
  } catch (e) {
    console.error("Error removing document: ", e);
    throw e;
  }
};
