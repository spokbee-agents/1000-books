"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, BookOpen, Sparkles, Loader2 } from "lucide-react";

interface Book {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
  pageCount: number | null;
}

const GOAL = 1000;
const STORAGE_KEY = "1000books_list";

function loadBooks(): Book[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBooks(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setBooks(loadBooks());
    setMounted(true);
  }, []);

  const addBook = useCallback((book: Book) => {
    setBooks((prev) => {
      const next = [book, ...prev];
      saveBooks(next);
      return next;
    });
  }, []);

  const removeBook = useCallback((id: number) => {
    setBooks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBooks(next);
      return next;
    });
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
            {mounted ? progress : 0}
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

      {/* Book Grid */}
      {mounted && books.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Your Library
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onRemove={removeBook} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {mounted && books.length === 0 && (
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
            onScanned={(book) => {
              addBook(book);
              setShowCamera(false);
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

function BookCard({
  book,
  onRemove,
}: {
  book: Book;
  onRemove: (id: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative bg-white rounded-xl shadow-md overflow-hidden group"
    >
      <button
        onClick={() => onRemove(book.id)}
        className="absolute top-1 right-1 z-10 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
        aria-label={`Remove ${book.title}`}
      >
        <X className="w-3 h-3 text-white" />
      </button>
      <div className="aspect-[2/3] bg-sky-50 flex items-center justify-center">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
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

function CameraModal({
  onClose,
  onScanned,
  scanning,
  setScanning,
  setError,
}: {
  onClose: () => void;
  onScanned: (book: Book) => void;
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

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

      const book: Book = await res.json();
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
