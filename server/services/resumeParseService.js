const parseResume = require("../utils/parseResume");

// ─── Resume Parse Service ────────────────────────────────────────────
/**
 * Parses a resume file (PDF / DOCX / JPG / PNG) and returns extracted
 * plain text. Delegates all extraction and OCR logic to the existing
 * parseResume utility — this service is the single import point for
 * controllers, keeping them free of direct utils/ dependencies.
 *
 * @param {Express.Multer.File} file - Multer file object (in-memory buffer).
 * @returns {Promise<string>} Cleaned plain-text content of the resume.
 */
const parseResumeFile = async (file) => {
  return parseResume(file);
};

module.exports = { parseResumeFile };
