// ─── ATS Service ────────────────────────────────────────────────────
// Owns all ATS-related post-processing that happens after AI calls:
//  - Proportional reconciliation of sectionsAnalysis.atsContribution
//  - Sanity-check warnings for mis-rated sections
//  - File-format checklist item (computed from mimetype, not AI)
//  - Merging AI checklist with the file-format item

// ─── buildFileFormatCheckItem ────────────────────────────────────────
/**
 * Generates the "File Format Risk" ATS checklist item based solely on
 * the file's MIME type — this check is deterministic and never comes
 * from the AI.
 *
 * @param {string} mimetype - MIME type of the uploaded file.
 * @returns {{ check: string, passed: boolean, detail: string }}
 */
const buildFileFormatCheckItem = (mimetype) => {
  const isImage =
    mimetype &&
    (mimetype.startsWith("image/") ||
      mimetype === "image/jpeg" ||
      mimetype === "image/png");

  const isPdfOrDocx =
    mimetype === "application/pdf" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const passed = isPdfOrDocx; // PDF and DOCX are low-risk; images are high-risk

  const detail = isImage
    ? "Processed via OCR (image-based) — highest ATS risk. Convert to a text-based PDF or DOCX."
    : isPdfOrDocx
    ? "PDF/DOCX format is well-supported by most ATS systems — low format risk."
    : "Unknown file format — ATS compatibility cannot be guaranteed.";

  return {
    check: "File Format Risk",
    passed,
    detail,
  };
};

// ─── reconcileAtsSections ────────────────────────────────────────────
/**
 * Proportionally scales each section's atsContribution so the array
 * sums exactly to targetScore. Handles rounding remainder by adjusting
 * the section with the highest contribution. If all contributions are
 * zero but targetScore is non-zero, distributes evenly.
 *
 * @param {Array<object>} sectionsAnalysis
 * @param {number} targetScore - The atsScore the contributions must sum to.
 * @returns {Array<object>} Adjusted sectionsAnalysis array.
 */
const reconcileAtsSections = (sectionsAnalysis, targetScore) => {
  if (!Array.isArray(sectionsAnalysis) || sectionsAnalysis.length === 0) {
    return sectionsAnalysis;
  }

  const rawSum = sectionsAnalysis.reduce(
    (acc, s) => acc + (typeof s.atsContribution === "number" ? s.atsContribution : 0),
    0
  );

  if (rawSum !== targetScore && rawSum > 0) {
    // Proportionally scale each section's contribution so they sum to targetScore.
    let runningTotal = 0;
    let adjusted = sectionsAnalysis.map((s, idx, arr) => {
      const original = typeof s.atsContribution === "number" ? s.atsContribution : 0;
      if (idx === arr.length - 1) {
        // Last section absorbs any rounding remainder to guarantee exact sum.
        return { ...s, atsContribution: Math.max(0, targetScore - runningTotal) };
      }
      const scaled = Math.round((original / rawSum) * targetScore);
      runningTotal += scaled;
      return { ...s, atsContribution: scaled };
    });

    // Rounding may cause the total to still miss by 1 — apply the difference to
    // whichever section currently has the highest contribution.
    const newSum = adjusted.reduce((acc, s) => acc + s.atsContribution, 0);
    const diff = targetScore - newSum;
    if (diff !== 0) {
      const maxIdx = adjusted.reduce(
        (best, s, i, arr) => (s.atsContribution >= arr[best].atsContribution ? i : best),
        0
      );
      adjusted[maxIdx].atsContribution = Math.max(
        0,
        adjusted[maxIdx].atsContribution + diff
      );
    }

    return adjusted;
  }

  if (rawSum === 0 && targetScore > 0) {
    // All contributions were 0 but atsScore is non-zero — distribute evenly.
    const perSection = Math.floor(targetScore / sectionsAnalysis.length);
    const remainder = targetScore - perSection * sectionsAnalysis.length;
    return sectionsAnalysis.map((s, i) => ({
      ...s,
      atsContribution: perSection + (i === 0 ? remainder : 0),
    }));
  }

  // rawSum already equals targetScore — no adjustment needed.
  return sectionsAnalysis;
};

// ─── runAtsSanityCheck ───────────────────────────────────────────────
/**
 * Warns (console.warn) when a section is rated "Strong" but the
 * majority of its itemized sub-entries have unresolved quality flags.
 * This is a logging/debugging guard — it does NOT modify the data.
 *
 * @param {Array<object>} sectionsAnalysis
 */
const runAtsSanityCheck = (sectionsAnalysis) => {
  if (!Array.isArray(sectionsAnalysis)) return;

  sectionsAnalysis.forEach((sectionAnalysis) => {
    const { section, quality, details } = sectionAnalysis || {};
    const items = details && Array.isArray(details.items) ? details.items : null;
    if (!items || items.length === 0) return;

    const itemsWithUnresolvedFlags = items.filter((it) => {
      if (!it) return false;
      const count =
        typeof it.unresolvedFlagCount === "number" ? it.unresolvedFlagCount : 0;
      return count > 0;
    }).length;

    const majorityUnresolved = itemsWithUnresolvedFlags > items.length / 2;

    if (quality === "Strong" && majorityUnresolved) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ATS scoring mismatch] Section "${section}" rated Strong but majority of items are unresolved.`
      );
    }
  });
};

// ─── buildFullChecklist ──────────────────────────────────────────────
/**
 * Merges the AI-generated ATS checklist with the deterministic
 * file-format check item. The file-format item is always appended last.
 *
 * @param {Array<object>} aiChecklist - The atsChecklist from the AI response.
 * @param {string} mimetype - MIME type of the uploaded file.
 * @returns {Array<object>} Complete checklist (AI items + file-format item).
 */
const buildFullChecklist = (aiChecklist, mimetype) => {
  const validAiChecklist = Array.isArray(aiChecklist) ? aiChecklist : [];
  const fileFormatItem = buildFileFormatCheckItem(mimetype);
  return [...validAiChecklist, fileFormatItem];
};

module.exports = {
  buildFileFormatCheckItem,
  reconcileAtsSections,
  runAtsSanityCheck,
  buildFullChecklist,
};
