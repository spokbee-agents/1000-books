import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

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
    const querySnapshot = await getDocs(q);
    const books: Book[] = [];
    querySnapshot.forEach((doc) => {
      books.push({ ...(doc.data() as Book), firestoreId: doc.id });
    });
    return books;
  } catch (e) {
    console.error("Error getting documents: ", e);
    return [];
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
