const mammoth = require("mammoth");
const { PDFExtract } = require("pdf.js-extract");
const { pdfToPng } = require("pdf-to-png-converter");
const Tesseract = require("tesseract.js");

// ─── Configuration ──────────────────────────────────────────────────

const MIN_USABLE_CHARS = 100; // below this we consider text extraction failed
const OCR_VIEWPORT_SCALE = 2.0; // 2x zoom for better OCR accuracy
const OCR_LANGUAGE = "eng"; // tesseract language

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Clean extracted text — collapse excessive whitespace, remove null
 * characters, and trim every line while preserving paragraph breaks.
 */
const cleanText = (raw) => {
  return raw
    .replace(/\0/g, "") // strip null bytes
    .replace(/\r\n/g, "\n") // normalise line endings
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
    .split("\n")
    .map((line) => line.trim()) // trim each line
    .filter((line, i, arr) => {
      // collapse 3+ consecutive blank lines into 2
      if (line === "" && arr[i - 1] === "" && arr[i - 2] === "") return false;
      return true;
    })
    .join("\n")
    .trim();
};

/**
 * Count meaningful characters (non-whitespace) in a string.
 */
const meaningfulLength = (text) => {
  return text ? text.replace(/\s/g, "").length : 0;
};

// ─── PDF Text Extraction Strategies ─────────────────────────────────

/**
 * Strategy 1: pdf-parse (fastest, works on simple text-based PDFs)
 */
const parsePdfPrimary = async (buffer) => {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
};

/**
 * Strategy 2: pdf.js-extract (handles designed/formatted/multi-column PDFs)
 * Extracts text with (x, y) coordinates per item, then reconstructs
 * reading order by sorting top-to-bottom, left-to-right.
 */
const parsePdfFallback = async (buffer) => {
  const pdfExtract = new PDFExtract();
  const data = await pdfExtract.extractBuffer(buffer, {});

  const lines = [];

  for (const page of data.pages) {
    if (!page.content || page.content.length === 0) continue;

    // Group text items into lines by their Y coordinate (within a tolerance)
    const yTolerance = 3;
    const lineMap = new Map();

    for (const item of page.content) {
      if (!item.str || item.str.trim() === "") continue;

      let foundKey = null;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - item.y) <= yTolerance) {
          foundKey = key;
          break;
        }
      }

      const bucketKey = foundKey !== null ? foundKey : item.y;
      if (!lineMap.has(bucketKey)) lineMap.set(bucketKey, []);
      lineMap.get(bucketKey).push(item);
    }

    const sortedKeys = [...lineMap.keys()].sort((a, b) => a - b);

    for (const key of sortedKeys) {
      const items = lineMap.get(key).sort((a, b) => a.x - b.x);
      const lineText = items.map((item) => item.str).join(" ");
      if (lineText.trim()) lines.push(lineText.trim());
    }

    lines.push(""); // blank line between pages
  }

  return lines.join("\n");
};

/**
 * Strategy 3: OCR — converts PDF pages to PNG images using pdf-to-png-converter,
 * then reads text from each image using tesseract.js.
 * This handles scanned/image-based PDFs that have zero selectable text.
 */
const parsePdfWithOCR = async (buffer) => {
  console.log("🔍 Starting OCR processing...");

  // Step 1: Convert PDF pages to PNG image buffers (in-memory, no disk writes)
  const pngPages = await pdfToPng(buffer, {
    viewportScale: OCR_VIEWPORT_SCALE,
    returnPageContent: true, // get PNG buffers in memory
  });

  if (!pngPages || pngPages.length === 0) {
    throw new Error("PDF has no pages to process for OCR.");
  }

  console.log(`📄 Converted ${pngPages.length} page(s) to images for OCR`);

  // Step 2: Create a tesseract worker and recognise text from each page image
  const worker = await Tesseract.createWorker(OCR_LANGUAGE);

  const pageTexts = [];

  for (let i = 0; i < pngPages.length; i++) {
    const page = pngPages[i];

    if (!page.content) {
      console.warn(`⚠️  Page ${i + 1} has no image content, skipping`);
      continue;
    }

    console.log(
      `🔎 OCR processing page ${i + 1}/${pngPages.length} (${page.width}x${page.height}px)...`
    );

    const {
      data: { text },
    } = await worker.recognize(page.content);

    if (text && text.trim()) {
      pageTexts.push(text.trim());
    }
  }

  // Step 3: Clean up the tesseract worker
  await worker.terminate();

  if (pageTexts.length === 0) {
    throw new Error("OCR could not extract any text from the PDF images.");
  }

  console.log(`✅ OCR complete — extracted text from ${pageTexts.length} page(s)`);

  return pageTexts.join("\n\n");
};

/**
 * Strategy 4 (images): OCR directly on an uploaded JPG/PNG image buffer.
 * Uses tesseract.js to extract text from the image.
 */
const parseImageWithOCR = async (buffer) => {
  console.log("🖼️  Starting OCR on uploaded image...");

  const worker = await Tesseract.createWorker(OCR_LANGUAGE);

  const {
    data: { text },
  } = await worker.recognize(buffer);

  await worker.terminate();

  if (!text || text.trim().length === 0) {
    throw new Error("OCR could not extract any text from the uploaded image.");
  }

  console.log(
    `✅ Image OCR complete — extracted ${meaningfulLength(text)} meaningful characters`
  );

  return text.trim();
};

// ─── Main Parser ────────────────────────────────────────────────────

const parseResume = async (file) => {
  const ext = file.originalname.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    let text = "";

    // ── Strategy 1: Try pdf-parse first (fast, works on simple PDFs)
    try {
      text = await parsePdfPrimary(file.buffer);
      console.log(
        `📋 pdf-parse extracted ${meaningfulLength(text)} meaningful characters`
      );
    } catch (err) {
      console.warn("⚠️  pdf-parse failed:", err.message);
    }

    // ── Strategy 2: If pdf-parse returned too little, try pdf.js-extract
    if (meaningfulLength(text) < MIN_USABLE_CHARS) {
      console.log(
        "🔄 pdf-parse returned insufficient text — trying pdf.js-extract..."
      );
      try {
        text = await parsePdfFallback(file.buffer);
        console.log(
          `📋 pdf.js-extract extracted ${meaningfulLength(text)} meaningful characters`
        );
      } catch (fallbackErr) {
        console.warn("⚠️  pdf.js-extract also failed:", fallbackErr.message);
      }
    }

    // ── Strategy 3: If still too little text, it's likely a scanned/image PDF → use OCR
    if (meaningfulLength(text) < MIN_USABLE_CHARS) {
      console.log(
        "🔄 Text extraction returned insufficient text — falling back to OCR (tesseract.js)..."
      );
      try {
        text = await parsePdfWithOCR(file.buffer);
        console.log(
          `📋 OCR extracted ${meaningfulLength(text)} meaningful characters`
        );
      } catch (ocrErr) {
        console.error("❌ OCR also failed:", ocrErr.message);
        throw new Error(
          "Could not extract text from this PDF using any method (text extraction + OCR). " +
            "The file may be corrupted or contain only non-text graphics. " +
            "Please try uploading a clearer PDF or a DOCX file."
        );
      }
    }

    // ── Final validation
    const finalText = cleanText(text);

    if (finalText.length < 30) {
      throw new Error(
        "Very little text was extracted from this PDF even after OCR. " +
          "The file may be heavily graphics-based or corrupted. " +
          "Please try uploading a different file."
      );
    }

    return finalText;

    // ── DOCX handling
  } else if (ext === "docx") {
    const data = await mammoth.extractRawText({
      buffer: file.buffer,
    });
    const text = cleanText(data.value);

    if (text.length < 30) {
      throw new Error(
        "Very little text was extracted from this DOCX. The file may be corrupted or nearly empty."
      );
    }

    return text;
    // ── Image handling (JPG / PNG) — OCR
  } else if (["jpg", "jpeg", "png"].includes(ext)) {
    let text = "";

    try {
      text = await parseImageWithOCR(file.buffer);
    } catch (err) {
      console.error("❌ Image OCR failed:", err.message);
      throw new Error(
        "Could not extract text from this image. " +
          "The image may be too blurry, low-resolution, or not a real resume. " +
          "Please try uploading a clearer image or a PDF/DOCX file."
      );
    }

    const finalText = cleanText(text);

    if (finalText.length < 30) {
      throw new Error(
        "Very little text was extracted from this image. " +
          "The image may be too blurry or not contain enough readable text. " +
          "Please try uploading a higher quality image or a PDF/DOCX file."
      );
    }

    return finalText;
  } else {
    throw new Error("Only PDF, DOCX, JPG, and PNG files are supported.");
  }
};

module.exports = parseResume;