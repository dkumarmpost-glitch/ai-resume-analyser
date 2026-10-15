// ─── Skills Service ──────────────────────────────────────────────────
// Normalizes arrays returned by the AI. The AI sometimes returns entries
// as objects (e.g. { name: "React" }, { language: "Python", proficiency:
// "Advanced" }, or { item: "React" }) instead of plain strings.
// These helpers guarantee all string arrays — including nested ones inside
// sectionsAnalysis.details.groups[].items — contain plain strings before
// the API response is sent, preventing React "Objects are not valid as a
// React child" crashes.

// ─── normalizeSkillArray ─────────────────────────────────────────────
/**
 * Normalizes a single skill array: converts any object entries to their
 * string representation, preserving plain strings as-is.
 *
 * @param {Array<string|object>} arr - Raw skill array from AI.
 * @returns {Array<string>} Array of plain skill strings.
 */
const normalizeSkillArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((s) => {
    if (typeof s === "string") return s;
    if (!s || typeof s !== "object") return String(s || "");
    if (s.name && s.impact && s.impact !== "Not specified") {
      return `${s.name}: ${s.impact}`;
    }
    if (s.name && s.relevance) {
      return `${s.name} (${s.relevance} relevance)`;
    }
    // Handle { language, proficiency } shape — returned by AI for language/tech
    // proficiency entries. Convert to a plain readable string.
    if (s.language) {
      return s.proficiency ? `${s.language} (${s.proficiency})` : s.language;
    }
    const fallback =
      s.name ||
      s.skill ||
      s.feedback ||
      s.evaluation ||
      s.text ||
      s.suggestion ||
      Object.values(s)
        .filter((v) => typeof v === "string" || typeof v === "number")
        .join(" - ");
    return fallback || String(s);
  });
};

// ─── normalizeSkills ─────────────────────────────────────────────────
/**
 * Normalizes all string array fields (`presentSkills`, `missingSkills`,
 * `projectsFeedback`, `certifications`, `suggestions`,
 * `techStackProficiency`) on the analysis object in place, guaranteeing
 * they contain plain strings for React rendering and MongoDB.
 *
 * `techStackProficiency` is included because the AI occasionally
 * hallucinates this field (mirroring the internal JS scorer name) as an
 * array of { language, proficiency } objects instead of a scalar score.
 * Normalizing it here strips any object entries to strings before the
 * response is sent, restoring Phase 1 API backward compatibility.
 *
 * @param {object} analysis - Merged AI analysis object.
 * @returns {object} The same analysis object with normalized string arrays.
 */
const normalizeSkills = (analysis) => {
  if (analysis.presentSkills) {
    analysis.presentSkills = normalizeSkillArray(analysis.presentSkills);
  }
  if (analysis.missingSkills) {
    analysis.missingSkills = normalizeSkillArray(analysis.missingSkills);
  }
  if (analysis.projectsFeedback) {
    analysis.projectsFeedback = normalizeSkillArray(analysis.projectsFeedback);
  }
  if (analysis.certifications) {
    analysis.certifications = normalizeSkillArray(analysis.certifications);
  }
  if (analysis.suggestions) {
    analysis.suggestions = normalizeSkillArray(analysis.suggestions);
  }
  // If the AI returns techStackProficiency as an array of objects
  // (e.g. [{ language, proficiency }]) instead of a scalar, flatten it
  // to an array of strings so it is safe to spread into the API response.
  if (Array.isArray(analysis.techStackProficiency)) {
    analysis.techStackProficiency = normalizeSkillArray(analysis.techStackProficiency);
  }
  // Normalize sectionsAnalysis[].details.groups[].items — the AI prompt
  // specifies items as [MAX 5] strings but the AI sometimes returns objects
  // like { item: "React" } instead of plain strings. These nested arrays
  // are NOT touched by any other normalizer, so they must be fixed here
  // before being sent in the API response or saved to MongoDB.
  if (Array.isArray(analysis.sectionsAnalysis)) {
    analysis.sectionsAnalysis = analysis.sectionsAnalysis.map((section) => {
      if (!section || !section.details || !Array.isArray(section.details.groups)) {
        return section;
      }
      return {
        ...section,
        details: {
          ...section.details,
          groups: section.details.groups.map((group) => {
            if (!group || !Array.isArray(group.items)) return group;
            return {
              ...group,
              items: normalizeSkillArray(group.items),
            };
          }),
        },
      };
    });
  }
  return analysis;
};

module.exports = { normalizeSkillArray, normalizeSkills };

