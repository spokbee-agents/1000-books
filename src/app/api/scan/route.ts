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
      console.error("GEMINI_API_KEY is missing in environment variables");
      return Response.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // The image payload from canvas.toDataURL() looks like "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
    // Gemini SDK requires JUST the base64 string, not the data URI prefix.
    const base64Data = image.includes("base64,") 
      ? image.split("base64,")[1] 
      : image;

    // Step 1: Use Gemini to identify the book
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let result;
    try {
      result = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        },
        {
          text: `Look at this image of a book or book cover. Identify the book title and author.
You MUST respond with ONLY a JSON object in this exact format, no markdown, no code fences:
{"title": "Book Title", "author": "Author Name"}

If you cannot identify the book, make your best guess based on what you see.`,
        },
      ]);
    } catch (modelError: any) {
      console.error("Gemini API Error:", modelError);
      return Response.json(
        { error: `Gemini API Error: ${modelError.message || "Unknown model error"}` },
        { status: 502 }
      );
    }

    const responseText = result.response.text().trim();

    // Parse the JSON — strip markdown fences if present
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: { title: string; author: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError: any) {
      console.error("Failed to parse Gemini JSON:", responseText);
      return Response.json(
        { error: `Failed to parse AI response. Raw output: ${responseText}` },
        { status: 422 }
      );
    }

    const { title, author } = parsed;

    if (!title || !author) {
      return Response.json(
        { error: "Could not identify the book title or author." },
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
    } catch (fetchError) {
      console.error("Google Books API Error:", fetchError);
      // Non-critical — we still have title + author from Gemini
    }

    return Response.json({
      id: Date.now(),
      title,
      author,
      coverUrl,
      pageCount,
    });
  } catch (err: any) {
    console.error("Scan route top-level error:", err);
    return Response.json(
      { error: `Server error: ${err.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
