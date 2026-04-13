"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import localforage from "localforage";
import {
  Camera,
  X,
  BookOpen,
  Sparkles,
  Loader2,
  Grid3X3,
  List,
  Download,
  Trash2,
} from "lucide-react";
import {
  saveBook as firebaseSaveBook,
  getBooks,
  removeBook as firebaseRemoveBook,
  Book,
} from "@/lib/firebase";

const GOAL = 1000;
const LOCAL_KEY = "books";

function exportCSV(books: Book[]) {
  const header = "Title,Author,Pages,Date Scanned";
  const rows = books.map((b) => {
    const date = new Date(b.timestamp).toLocaleDateString();
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return `${esc(b.title)},${esc(b.author)},${b.pageCount ?? ""},${date}`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "1000-books-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Deduplicate books by matching on timestamp (primary) or title (fallback) */
function mergeBooks(localBooks: Book[], cloudBooks: Book[]): Book[] {
  const seen = new Map<string, Book>();
  for (const b of localBooks) {
    seen.set(`${b.timestamp}`, b);
  }
  for (const b of cloudBooks) {
    const key = `${b.timestamp}`;
    if (!seen.has(key)) {
      seen.set(key, b);
    } else {
      // Cloud copy has a real firestoreId — keep it so we can delete later
      const existing = seen.get(key)!;
      if (!existing.firestoreId && b.firestoreId) {
        seen.set(key, { ...existing, firestoreId: b.firestoreId });
      } else if (b.firestoreId && !existing.firestoreId?.startsWith("local-")) {
        seen.set(key, { ...existing, firestoreId: b.firestoreId });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"gallery" | "list">("gallery");

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Step 1: Instantly load from localforage (has the missing books)
      const localBooks = (await localforage.getItem<Book[]>(LOCAL_KEY)) || [];
      if (!cancelled && localBooks.length > 0) {
        setBooks(localBooks);
        setLoading(false);
      }

      // Step 2: Background-fetch from Firestore
      try {
        const cloudBooks = await getBooks();
        if (cancelled) return;

        const merged = mergeBooks(localBooks, cloudBooks);

        // Upload any local-only books to Firestore
        const cloudTimestamps = new Set(cloudBooks.map((b) => b.timestamp));
        for (const book of localBooks) {
          if (!cloudTimestamps.has(book.timestamp)) {
            firebaseSaveBook(book).catch((e) =>
              console.warn("Background upload failed:", e)
            );
          }
        }

        // Force UI to show cloud books even if local is empty
        await localforage.setItem(LOCAL_KEY, merged);
        if (!cancelled) {
          setBooks(merged);
        }
      } catch (err: any) {
        console.error("Cloud sync failed:", err.message);
        if (!cancelled) setError("Could not fetch from database. You are offline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  const addBook = useCallback(async (book: Book): Promise<boolean> => {
    // Instant local-first: push to localforage + React state immediately
    const localBook = { ...book, firestoreId: "local-" + Date.now() };

    setBooks((prev) => {
      const next = [localBook, ...prev];
      localforage.setItem(LOCAL_KEY, next).catch(console.error);
      return next;
    });

    // Fire-and-forget cloud save — never blocks the UI
    firebaseSaveBook(book)
      .then((saved) => {
        // Patch in the real firestoreId so deletes work against the cloud
        setBooks((prev) => {
          const next = prev.map((b) =>
            b.firestoreId === localBook.firestoreId ? { ...b, firestoreId: saved.firestoreId } : b
          );
          localforage.setItem(LOCAL_KEY, next).catch(console.error);
          return next;
        });
      })
      .catch((err) => {
        console.warn("Cloud save failed (book kept locally):", err);
      });

    return true;
  }, []);

  const removeBook = useCallback(async (firestoreId: string) => {
    // Instant local removal
    setBooks((prev) => {
      const next = prev.filter((b) => b.firestoreId !== firestoreId);
      localforage.setItem(LOCAL_KEY, next).catch(console.error);
      return next;
    });

    // Fire-and-forget cloud removal (skip if it was never uploaded)
    if (!firestoreId.startsWith("local-")) {
      firebaseRemoveBook(firestoreId).catch((err) =>
        console.warn("Cloud delete failed:", err)
      );
    }
  }, []);

  const progress = books.length;
  const pct = Math.min((progress / GOAL) * 100, 100);

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-6 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-sky-600 flex items-center justify-center gap-2">
          <BookOpen className="w-8 h-8" />
          1,000 Books
        </h1>
        <p className="text-sm text-slate-500 mt-1">Summer Reading Challenge</p>
      </motion.div>

      {/* Progress Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 mb-6"
      >
        <div className="text-center mb-4">
          <span className="text-5xl font-black text-sky-600">
            {progress}
          </span>
          <span className="text-2xl font-bold text-slate-400">
            {" "}
            / {GOAL}
          </span>
          <p className="text-lg font-semibold text-slate-600 mt-1">
            Books Read!
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-8 bg-sky-100 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 via-violet-500 to-rose-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <div className="absolute inset-0 animate-shimmer rounded-full" />
          {pct > 5 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
              {pct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Milestone markers */}
        <div className="flex justify-between mt-2 text-[10px] font-medium text-slate-400">
          <span>0</span>
          <span>250</span>
          <span>500</span>
          <span>750</span>
          <span>1000</span>
        </div>
      </motion.div>

      {/* Scan Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setError(null);
          setShowCamera(true);
        }}
        className="w-full max-w-md h-16 bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xl font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-6 animate-pulse-glow active:shadow-none transition-shadow"
      >
        <Camera className="w-7 h-7" />
        Scan a Book!
      </motion.button>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 mb-4 text-sm text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 mt-8"
        >
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading your library...</p>
        </motion.div>
      )}

      {/* Library Section */}
      {!loading && books.length > 0 && (
        <div className="w-full max-w-md">
          {/* Library header with controls */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Your Library
            </h2>
            <div className="flex items-center gap-2">
              {/* Export CSV */}
              <button
                onClick={() => exportCSV(books)}
                className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-500 hover:border-emerald-300 transition-colors"
                aria-label="Export CSV"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
              {/* View toggle */}
              <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setView("gallery")}
                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
                    view === "gallery"
                      ? "bg-sky-500 text-white"
                      : "text-slate-400 hover:text-sky-500"
                  }`}
                  aria-label="Gallery view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
                    view === "list"
                      ? "bg-sky-500 text-white"
                      : "text-slate-400 hover:text-sky-500"
                  }`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Gallery View */}
          {view === "gallery" && (
            <div className="grid grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {books.map((book) => (
                  <GalleryCard
                    key={book.firestoreId}
                    book={book}
                    onRemove={removeBook}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* List View */}
          {view === "list" && (
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {books.map((book, i) => (
                  <ListRow
                    key={book.firestoreId}
                    book={book}
                    index={i}
                    onRemove={removeBook}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {!loading && books.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-slate-400 text-center mt-8"
        >
          No books yet — scan your first one!
        </motion.p>
      )}

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <CameraModal
            onClose={() => setShowCamera(false)}
            onScanned={async (book) => {
              setScanning(true);
              try {
                await addBook(book);
                setShowCamera(false);
              } catch(e: any) {
                setError("Fatal Error: " + String(e.message));
              } finally {
                setScanning(false);
              }
            }}
            scanning={scanning}
            setScanning={setScanning}
            setError={setError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Gallery Card — polaroid-style with captured image         */
/* ────────────────────────────────────────────────────────── */

function GalleryCard({
  book,
  onRemove,
}: {
  book: Book;
  onRemove: (firestoreId: string) => void;
}) {
  const thumb = book.capturedImage || book.coverUrl;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative bg-white rounded-2xl shadow-md overflow-hidden group ring-1 ring-slate-100"
    >
      <button
        onClick={() => book.firestoreId && onRemove(book.firestoreId)}
        className="absolute top-1 right-1 z-10 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
        aria-label={`Remove ${book.title}`}
      >
        <Trash2 className="w-3 h-3 text-white" />
      </button>

      <div className="aspect-[2/3] bg-sky-50 flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen className="w-10 h-10 text-sky-300" />
        )}
      </div>

      <div className="p-2">
        <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2">
          {book.title}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
          {book.author}
        </p>
        {book.pageCount && (
          <p className="text-[10px] text-sky-500 font-medium">
            {book.pageCount} pages
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* List Row — compact title + author                         */
/* ────────────────────────────────────────────────────────── */

function ListRow({
  book,
  index,
  onRemove,
}: {
  book: Book;
  index: number;
  onRemove: (firestoreId: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center bg-white rounded-xl shadow-sm px-4 py-3 gap-3 group ring-1 ring-slate-100"
    >
      <span className="text-xs font-bold text-sky-400 w-6 text-right shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">
          {book.title}
        </p>
        <p className="text-xs text-slate-400 truncate">{book.author}</p>
      </div>
      {book.pageCount && (
        <span className="text-[10px] text-sky-500 font-medium shrink-0">
          {book.pageCount}p
        </span>
      )}
      <button
        onClick={() => book.firestoreId && onRemove(book.firestoreId)}
        className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity shrink-0"
        aria-label={`Remove ${book.title}`}
      >
        <Trash2 className="w-3 h-3 text-rose-400" />
      </button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Camera Modal                                              */
/* ────────────────────────────────────────────────────────── */

function CameraModal({
  onClose,
  onScanned,
  scanning,
  setScanning,
  setError,
}: {
  onClose: () => void;
  onScanned: (book: Book) => void | Promise<void>;
  scanning: boolean;
  setScanning: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setError("Could not access camera. Please allow camera permissions.");
        onClose();
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose, setError]);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setScanning(true);
    setError(null);

    // Compress aggressively for Firestore: max 400px wide, JPEG at 40% quality
    // This ensures the Base64 string never exceeds Firestore's 1MB document limit
    const MAX_WIDTH = 400;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.4);
    
    // Failsafe: if it's still somehow over 800KB, crush it to 10% quality
    if (dataUrl.length > 800000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.1);
    }
    const base64 = dataUrl.split(",")[1];

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Scan failed (${res.status})`);
      }

      const apiBook = await res.json();

      // Build full Book with captured image
      const book: Book = {
        id: apiBook.id ?? Date.now(),
        title: apiBook.title,
        author: apiBook.author,
        coverUrl: apiBook.coverUrl ?? null,
        pageCount: apiBook.pageCount ?? null,
        capturedImage: dataUrl,
        timestamp: Date.now(),
      };

      onScanned(book);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      onClose();
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4"
          >
            <Loader2 className="w-16 h-16 text-sky-400 animate-spin" />
            <p className="text-white text-lg font-semibold">
              Identifying book...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 p-6 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onClose();
          }}
          className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          disabled={scanning}
        >
          <X className="w-7 h-7 text-white" />
        </button>

        <button
          onClick={capture}
          disabled={scanning}
          className="w-20 h-20 rounded-full bg-white border-4 border-sky-400 flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          <Camera className="w-9 h-9 text-sky-600" />
        </button>

        <div className="w-14 h-14" /> {/* Spacer for centering */}
      </div>
    </motion.div>
  );
}
