import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBvu1DQDq1Bc10-sgxjspt3EEJ-tEMskHM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "spokbee-agents.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "spokbee-agents",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "spokbee-agents.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "289955521641",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:289955521641:web:dcb4116961c98df869aef8"
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
  kidId?: string;
}

export interface Kid {
  id: string;
  firestoreId?: string;
  name: string;
  color: string;
  timestamp: number;
}

export const saveBook = async (book: Book) => {
  try {
    // Firestore rejects 'undefined' fields. We must sanitize the book object (especially old V0 books).
    const sanitizedBook: Record<string, any> = {
      id: book.id || Date.now(),
      title: book.title || "Unknown Title",
      author: book.author || "Unknown Author",
      pageCount: book.pageCount ?? null,
      capturedImage: book.capturedImage ?? null,
      coverUrl: book.coverUrl ?? null,
      timestamp: book.timestamp || Date.now()
    };
    if (book.kidId) {
      sanitizedBook.kidId = book.kidId;
    }
    if (book.firestoreId) {
      (sanitizedBook as any).firestoreId = book.firestoreId;
    }

    const docRef = await addDoc(collection(db, "books"), sanitizedBook);
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

export const saveKid = async (kid: Kid) => {
  try {
    const sanitizedKid: Record<string, any> = {
      id: kid.id,
      name: kid.name,
      color: kid.color,
      timestamp: kid.timestamp,
    };
    if (kid.firestoreId) {
      sanitizedKid.firestoreId = kid.firestoreId;
    }
    const docRef = await addDoc(collection(db, "kids"), sanitizedKid);
    return { ...kid, firestoreId: docRef.id };
  } catch (e) {
    console.error("Error saving kid: ", e);
    throw e;
  }
};

export const getKids = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "kids"));
    const kids: Kid[] = [];
    querySnapshot.forEach((doc: any) => {
      kids.push({ ...(doc.data() as Kid), firestoreId: doc.id });
    });
    return kids.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e: any) {
    console.error("Error getting kids: ", e);
    throw new Error("Firestore Kids Fetch Error: " + (e.message || String(e)));
  }
};

export const removeKid = async (firestoreId: string) => {
  try {
    await deleteDoc(doc(db, "kids", firestoreId));
  } catch (e) {
    console.error("Error removing kid: ", e);
    throw e;
  }
};
