import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== "string") {
      return Response.json(
        { error: "Missing image data" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Step 1: Use Gemini to identify the book
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      },
      {
        text: `Look at this image of a book or book cover. Identify the book title and author.
You MUST respond with ONLY a JSON object in this exact format, no markdown, no code fences:
{"title": "Book Title", "author": "Author Name"}

If you cannot identify the book, make your best guess based on what you see.`,
      },
    ]);

    const responseText = result.response.text().trim();

    // Parse the JSON — strip markdown fences if present
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: { title: string; author: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "Could not identify the book. Try a clearer photo." },
        { status: 422 }
      );
    }

    const { title, author } = parsed;

    if (!title || !author) {
      return Response.json(
        { error: "Could not identify the book. Try a clearer photo." },
        { status: 422 }
      );
    }

    // Step 2: Look up on Google Books API for cover art + page count
    let coverUrl: string | null = null;
    let pageCount: number | null = null;

    try {
      const query = `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`;
      const booksRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
      );

      if (booksRes.ok) {
        const booksData = await booksRes.json();
        const volume = booksData.items?.[0]?.volumeInfo;

        if (volume) {
          // Prefer larger images, fall back to thumbnail
          const links = volume.imageLinks;
          coverUrl =
            links?.medium ||
            links?.small ||
            links?.thumbnail ||
            null;

          // Force HTTPS
          if (coverUrl) {
            coverUrl = coverUrl.replace(/^http:/, "https:");
          }

          pageCount = volume.pageCount ?? null;
        }
      }
    } catch {
      // Non-critical — we still have title + author from Gemini
    }

    return Response.json({
      id: Date.now(),
      title,
      author,
      coverUrl,
      pageCount,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
