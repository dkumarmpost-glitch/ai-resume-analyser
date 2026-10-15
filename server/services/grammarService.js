const scoringService = require("./scoringService");

// ─── Grammar Service ─────────────────────────────────────────────────
// Owns:
//  - The grammar analysis prompt template
//  - The deterministic grammarScore formula (computed from real issues,
//    never trusted from the AI)
//  - The finalizeGrammarAnalysis helper that stamps the computed score
//    and corrects totalIssues on a parsed AI grammar response

// ─── buildGrammarPrompt ──────────────────────────────────────────────
/**
 * Builds the full prompt string for the dedicated grammar analysis
 * endpoint. The grammarScore field is intentionally omitted from the
 * prompt because it is computed deterministically in finalizeGrammarAnalysis.
 *
 * @param {string} rawText - The raw extracted resume text.
 * @returns {string} Complete prompt string ready to send to the AI.
 */
const buildGrammarPrompt = (rawText) => {
  return `Analyse the resume text and return ONLY raw JSON matching this schema:
{
  "overallImpactScore": number, // 0-10, average of sentence impact scores
  "sentences": [
    {
      "original": "string", // quote sentence/bullet exactly; preserve exact spaces
      "impactScore": number, // 0-10 (0-4 weak, 5-7 medium, 8-10 strong)
      "level": "weak" | "medium" | "strong",
      "issues": ["string"], // specific problems found, or [] if none
      "powerRewrite": "string | null" // action verb + detail + metric; ONLY if impactScore < 6 (max 15 total), else null
    }
  ],
  "grammarIssues": [
    {
      "original": "string", // exact problematic phrase from resume
      "corrected": "string", // corrected version
      "type": "spelling" | "punctuation" | "tense" | "passive_voice" | "filler_phrase" | "weak_verb" | "missing_metrics"
    }
  ],
  "weakPatterns": {
    "passiveVoiceCount": number, // total count across full resume text
    "fillerPhraseCount": number,
    "weakVerbCount": number,
    "missingMetricsCount": number
  }
}

Rules:
- Thoroughly detect all grammar, spelling, punctuation, tense, passive voice, filler phrases, weak verbs, and missing metrics.
- weakPatterns must count all instances in the full resume text.

Resume text:
${rawText}`;
};

// ─── computeGrammarScore ─────────────────────────────────────────────
/**
 * Deterministically computes the grammar score using scoringService.calculateGrammarScore
 * as the single source of truth across the entire application.
 *
 * @param {object} ga - Parsed grammar analysis from the AI.
 * @param {string} [rawText=""] - Extracted resume text.
 * @returns {number} Integer grammar score in the range [30, 100].
 */
const computeGrammarScore = (ga, rawText = "") => {
  if (!ga) return 100;
  const issues = Array.isArray(ga.grammarIssues) ? ga.grammarIssues : [];
  const sentences = Array.isArray(ga.sentences) ? ga.sentences : [];
  const weakPatterns = ga.weakPatterns || {};
  const overallImpactScore = ga.overallImpactScore;

  return scoringService.calculateGrammarScore({
    grammarIssues: issues,
    resumeText: rawText,
    overallImpactScore,
    sentences,
    weakPatterns,
  });
};

// ─── finalizeGrammarAnalysis ─────────────────────────────────────────
/**
 * Stamps the deterministic grammarScore, reconciles sentence whitespace,
 * normalizes grammarIssues fields for backward compatibility, and corrects totalIssues.
 *
 * @param {object} grammarAnalysis - Parsed AI grammar analysis.
 * @param {string} [rawText=""] - Extracted resume text.
 * @returns {object} The same object with grammarScore and totalIssues set.
 */
const finalizeGrammarAnalysis = (grammarAnalysis, rawText = "") => {
  if (!grammarAnalysis || typeof grammarAnalysis !== "object") {
    grammarAnalysis = {};
  }

  // 1. Normalize and sanitize grammarIssues
  let grammarIssues = Array.isArray(grammarAnalysis.grammarIssues)
    ? grammarAnalysis.grammarIssues
    : [];

  const VALID_TYPES = new Set([
    "spelling",
    "punctuation",
    "tense",
    "passive_voice",
    "filler_phrase",
    "weak_verb",
    "missing_metrics",
  ]);

  const issueTypeCounts = {
    passive_voice: 0,
    filler_phrase: 0,
    weak_verb: 0,
    missing_metrics: 0,
  };

  grammarIssues = grammarIssues.map((iss) => {
    if (!iss || typeof iss !== "object") iss = {};
    const original = String(iss.original || iss.text || "").trim();
    const corrected = String(iss.corrected || iss.fix || "").trim();
    let rawType = String(iss.type || "other")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");

    if (!VALID_TYPES.has(rawType)) {
      if (rawType.includes("spell")) rawType = "spelling";
      else if (rawType.includes("punct")) rawType = "punctuation";
      else if (rawType.includes("tense")) rawType = "tense";
      else if (rawType.includes("passive")) rawType = "passive_voice";
      else if (rawType.includes("filler")) rawType = "filler_phrase";
      else if (rawType.includes("verb")) rawType = "weak_verb";
      else if (rawType.includes("metric")) rawType = "missing_metrics";
      else rawType = "other";
    }

    if (issueTypeCounts[rawType] !== undefined) {
      issueTypeCounts[rawType]++;
    }

    return {
      ...iss,
      original,
      corrected,
      type: rawType,
      text: iss.text || original,
      fix: iss.fix || corrected,
    };
  });

  grammarAnalysis.grammarIssues = grammarIssues;

  // 2. Ensure totalIssues reflects the real array length
  grammarAnalysis.totalIssues = grammarIssues.length;

  // 3. Normalize and sanitize weakPatterns
  const rawPatterns = grammarAnalysis.weakPatterns || {};
  grammarAnalysis.weakPatterns = {
    passiveVoiceCount: Math.max(
      Number(rawPatterns.passiveVoiceCount) || 0,
      issueTypeCounts.passive_voice
    ),
    fillerPhraseCount: Math.max(
      Number(rawPatterns.fillerPhraseCount) || 0,
      issueTypeCounts.filler_phrase
    ),
    weakVerbCount: Math.max(
      Number(rawPatterns.weakVerbCount) || 0,
      issueTypeCounts.weak_verb
    ),
    missingMetricsCount: Math.max(
      Number(rawPatterns.missingMetricsCount) || 0,
      issueTypeCounts.missing_metrics
    ),
  };

  // 4. Normalize sentences, sentence levels, power rewrites, and whitespace
  if (Array.isArray(grammarAnalysis.sentences)) {
    const cleanRaw = rawText;
    const strippedRaw = cleanRaw ? cleanRaw.replace(/\s+/g, "") : "";

    grammarAnalysis.sentences = grammarAnalysis.sentences.map((s) => {
      if (!s || typeof s !== "object") return s;

      // Reconcile sentence whitespace with raw text
      if (cleanRaw && s.original) {
        const strippedTarget = s.original.replace(/\s+/g, "");
        if (strippedTarget && strippedRaw) {
          const idx = strippedRaw.indexOf(strippedTarget);
          if (idx !== -1) {
            let strippedCount = 0;
            let startRawIdx = -1;
            let endRawIdx = -1;

            for (let i = 0; i < cleanRaw.length; i++) {
              if (!/\s/.test(cleanRaw[i])) {
                if (strippedCount === idx) startRawIdx = i;
                strippedCount++;
                if (strippedCount === idx + strippedTarget.length) {
                  endRawIdx = i + 1;
                  break;
                }
              }
            }

            if (startRawIdx !== -1 && endRawIdx !== -1) {
              s.original = cleanRaw.substring(startRawIdx, endRawIdx).trim();
            }
          }
        }
      }

      // Enforce numeric impactScore and matching level
      let impactScore =
        typeof s.impactScore === "number" && !isNaN(s.impactScore)
          ? Math.max(0, Math.min(10, Math.round(s.impactScore * 10) / 10))
          : 5;

      let level = "medium";
      if (impactScore <= 4) level = "weak";
      else if (impactScore >= 8) level = "strong";

      // Enforce powerRewrite rule: ONLY for impactScore < 6
      let powerRewrite = s.powerRewrite || null;
      if (impactScore >= 6) {
        powerRewrite = null;
      }

      return {
        ...s,
        impactScore,
        level,
        powerRewrite,
        issues: Array.isArray(s.issues) ? s.issues : [],
      };
    });

    // Synchronize overallImpactScore from sentence impact averages
    if (grammarAnalysis.sentences.length > 0) {
      const sumImpact = grammarAnalysis.sentences.reduce(
        (sum, s) => sum + (s.impactScore || 0),
        0
      );
      const avgImpact =
        Math.round((sumImpact / grammarAnalysis.sentences.length) * 10) / 10;
      grammarAnalysis.overallImpactScore = avgImpact;
    }
  }

  if (
    typeof grammarAnalysis.overallImpactScore !== "number" ||
    isNaN(grammarAnalysis.overallImpactScore)
  ) {
    grammarAnalysis.overallImpactScore = 5;
  }

  // 5. Deterministic grammarScore calculation
  grammarAnalysis.grammarScore = computeGrammarScore(grammarAnalysis, rawText);

  return grammarAnalysis;
};

module.exports = { buildGrammarPrompt, computeGrammarScore, finalizeGrammarAnalysis };

