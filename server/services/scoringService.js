// ─── Scoring Service ──────────────────────────────────────────────────────────

const normalizeScores = (value, min = 0, max = 100) => {
  if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
};

const validateScores = (scores) => {
  if (!scores || typeof scores !== "object") return false;
  return Object.values(scores).every(
    (val) => typeof val === "number" && !isNaN(val) && val >= 0 && val <= 100
  );
};

const calculateATSScore = ({ resumeText = "", atsChecklist = [], sectionsAnalysis = [] }) => {

  // ── Layer 1: Structural ATS Compatibility (max 20 pts) ───────────────────────
  // Use TRUE proportion: passed / total checklist items.
  // A resume that passes 3 of 8 items should NOT receive 15/15.
  // If the checklist is empty or malformed, use a conservative fallback (5 pts).
  const validItems  = Array.isArray(atsChecklist) ? atsChecklist.filter((i) => i && typeof i === "object") : [];
  const totalItems  = validItems.length;
  const passedItems = validItems.filter((i) => i.passed === true).length;

  let layer1Score;
  if (totalItems === 0) {
    layer1Score = 5; // no checklist data — conservative fallback, not full credit
  } else {
    layer1Score = Math.round((passedItems / totalItems) * 20);
  }
  layer1Score = Math.min(20, Math.max(0, layer1Score));

  // ── Layer 2: Section Completeness (max 25 pts, diminishing returns) ───────────
  // Universal section aliases — grouped so multiple names for the same concept
  // collapse to ONE distinct group key. Field-independent: no tech/CSE assumptions.
  const SECTION_GROUPS = {
    intro:          ["summary", "objective", "profile", "about", "overview", "personal statement"],
    experience:     ["experience", "employment", "work history", "work experience", "professional experience", "career history"],
    education:      ["education", "academic", "qualification", "degree"],
    skills:         ["skill", "competenc", "expertise", "technical", "proficienc", "tool", "technology", "software"],
    projects:       ["project", "portfolio", "case stud"],
    certifications: ["certification", "certificate", "credential", "accreditation", "license"],
    awards:         ["award", "achievement", "honor", "recognition", "distinction"],
    publications:   ["publication", "paper", "research", "thesis", "journal"],
    volunteer:      ["volunteer", "community", "social work", "non-profit", "nonprofit"],
    leadership:     ["leadership", "management", "club", "society", "organization", "association"],
    languages:      ["language", "linguistic"],
    interests:      ["interest", "hobby", "hobbies", "extracurricular", "activity"],
  };

  const foundGroups = new Set();
  if (Array.isArray(sectionsAnalysis)) {
    sectionsAnalysis.forEach((s) => {
      const name = (s && s.section ? String(s.section) : "").toLowerCase().trim();
      if (!name) return;
      for (const [groupKey, aliases] of Object.entries(SECTION_GROUPS)) {
        if (aliases.some((alias) => name.includes(alias))) {
          foundGroups.add(groupKey);
          break; // only one group match per section entry
        }
      }
    });
  }
  const distinctSections = foundGroups.size;

  // Diminishing-returns curve (max 25 pts):
  //   Sections counted:  1    2    3    4    5    6    7+
  //   Marginal pts:      6    5    5    4    3    2    0
  //   Running total:     6   11   16   20   23   25   25
  // A 2-section resume scores 11/25; a 5-section resume 23/25.
  // Having 5+ sections and weak content should NOT outscore
  // a 3-section resume with strong content.
  const SECTION_INCREMENTS = [6, 5, 5, 4, 3, 2, 0, 0, 0, 0, 0, 0];
  let layer2Score = 0;
  for (let i = 0; i < distinctSections; i++) {
    layer2Score += SECTION_INCREMENTS[i] ?? 0;
  }
  layer2Score = Math.min(25, Math.max(0, layer2Score));


  // ── Layer 3: Content Quality (max 55 pts) ────────────────────────────────────
  // The PRIMARY and most important component.
  // Uses sectionsAnalysis[].quality values from the AI response — no new AI calls.
  // Quality mapping (55-pt scale):
  //   Strong          = 55   (excellent, specific, impactful)
  //   Adequate        = 38   (solid but not exceptional)
  //   Weak            = 20   (vague, generic, or surface-level)
  //   Minimal/unknown =  8   (nearly empty or no data)
  //
  // Average is taken across ALL sections the AI analysed.
  // A large number of Adequate sections does NOT produce a Strong result.
  let qualitySum  = 0;
  const sectionCount = Array.isArray(sectionsAnalysis) ? sectionsAnalysis.length : 0;

  if (sectionCount > 0) {
    sectionsAnalysis.forEach((s) => {
      const q = s && typeof s.quality === "string" ? s.quality.trim() : "";
      if      (q === "Strong")   qualitySum += 55;
      else if (q === "Adequate") qualitySum += 38;
      else if (q === "Weak")     qualitySum += 20;
      else                       qualitySum += 8;  // Minimal / unknown / missing
    });
    qualitySum = qualitySum / sectionCount; // average: 0–55 scale
  } else {
    qualitySum = 15; // conservative — no AI quality data available
  }
  if (!isFinite(qualitySum) || isNaN(qualitySum)) qualitySum = 15;

  const layer3Score = Math.min(55, Math.max(0, Math.round(qualitySum)));

  // ── Evidence / Metrics Bonus (max 10 pts — positive signal ONLY) ─────────────
  // Broad, field-independent regex: %, currency (any symbol), multipliers,
  // durations, large counts, contextual scale nouns.
  // Absence of metrics is NOT penalised — it simply forgoes the bonus.
  // Works for finance, healthcare, marketing, HR, sales, engineering, etc.
  const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(
    (l) => /^[-•*▪▸]/.test(l) || /^\d+[\.\)]/.test(l) || l.length > 20
  );
  const totalBullets = bulletLines.length;

  const metricRegex =
    /(\d+\s*%|\b\d+\s*x\b|[$€£¥₹]\s*\d+|\d+\s*[$€£¥₹]|\d+[km]\b|\d+\+\b|\d{4,}|\b\d+\s+years?\b|\b\d+\s+months?\b|\b\d+\s+(?:people|users|clients|team|member|student|employee|project|account|market|million|billion|thousand|hundred)\b)/i;

  const metricBullets = bulletLines.filter((l) => metricRegex.test(l)).length;
  const metricRate    = totalBullets > 0 ? (metricBullets / totalBullets) * 100 : 0;

  // Smooth, uncapped bonus: 0 pts at 0%, up to 10 pts at ≥ 40% metric rate.
  const evidenceBonus = Math.min(10, Math.round((metricRate / 40) * 10));

  // ── Final ATS Score ───────────────────────────────────────────────────────────
  // Formula: structural (20) + sections (25) + quality (55) + evidence (10) = 100
  const rawTotal = layer1Score + layer2Score + layer3Score + evidenceBonus;
  const atsScore = normalizeScores(rawTotal, 0, 100);

  // ── Debug logging ─────────────────────────────────────────────────────────────
  console.log("\n========== ATS DEBUG ==========");
  console.log("Formula                 : structural(20) + sections(25) + quality(55) + evidence(10) = 100");
  console.log("Resume text length      :", resumeText.length);
  console.log("Passed ATS items        :", passedItems, "/", totalItems);
  console.log("Layer 1 (structural)    :", layer1Score, "/ 20  [passed/total × 20]");
  console.log("Distinct sections found :", distinctSections, "→ groups:", [...foundGroups].join(", ") || "none");
  console.log("Layer 2 (sections)      :", layer2Score, "/ 25  [diminishing returns, 6th+ section = 0 pts]");
  console.log("Section quality avg     :", qualitySum.toFixed(2), "/ 55  (Strong=55 Adequate=38 Weak=20 Minimal=8)");
  console.log("Layer 3 (content qual.) :", layer3Score, "/ 55");
  console.log("Total bullet lines      :", totalBullets);
  console.log("Metric bullet lines     :", metricBullets);
  console.log("Metric rate             :", metricRate.toFixed(2) + "%");
  console.log("Evidence bonus          :", evidenceBonus, "/ 10  [NO hard cap — positive signal only]");
  console.log("Raw ATS score           :", rawTotal, "/ 100");
  console.log("Final ATS score         :", atsScore);
  console.log("==============================\n");

  return atsScore;
};

const calculateSkillMatch = ({ presentSkills = [], missingSkills = [] }) => {
  const pCount = Array.isArray(presentSkills) ? presentSkills.length : 0;
  const mCount = Array.isArray(missingSkills) ? missingSkills.length : 0;
  const total = pCount + mCount;
  if (total === 0) return 70;
  const rawMatch = (pCount / total) * 100;
  return normalizeScores(rawMatch, 0, 100);
};

const calculateGrammarScore = ({
  grammarIssues = [],
  resumeText = "",
  overallImpactScore = null,
  sentences = [],
  weakPatterns = {},
}) => {
  let score = 100;

  const WEIGHTS = {
    spelling: 5,
    tense: 4,
    punctuation: 2,
    passive_voice: 2,
    filler_phrase: 1,
    weak_verb: 1,
    missing_metrics: 0,
    other: 1,
  };

  const issueCounts = {
    spelling: 0,
    tense: 0,
    punctuation: 0,
    passive_voice: 0,
    filler_phrase: 0,
    weak_verb: 0,
    missing_metrics: 0,
  };

  if (Array.isArray(grammarIssues)) {
    grammarIssues.forEach((issue) => {
      if (!issue || typeof issue !== "object") return;

      const rawType = String(issue.type || "other")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_");

      const type = Object.prototype.hasOwnProperty.call(WEIGHTS, rawType)
        ? rawType
        : "other";

      if (issueCounts[type] !== undefined) {
        issueCounts[type]++;
      }

      score -= WEIGHTS[type];
    });
  }

  const patterns =
    weakPatterns && typeof weakPatterns === "object"
      ? weakPatterns
      : {};

  const passiveCount = Math.max(
    0,
    Number(patterns.passiveVoiceCount) || 0
  );

  const fillerCount = Math.max(
    0,
    Number(patterns.fillerPhraseCount) || 0
  );

  const weakVerbCount = Math.max(
    0,
    Number(patterns.weakVerbCount) || 0
  );

  const missingMetricsCount = Math.max(
    0,
    Number(patterns.missingMetricsCount) || 0
  );

  const extraPassive = Math.max(
    0,
    passiveCount - issueCounts.passive_voice
  );

  const extraFiller = Math.max(
    0,
    fillerCount - issueCounts.filler_phrase
  );

  const extraWeakVerbs = Math.max(
    0,
    weakVerbCount - issueCounts.weak_verb
  );

  const extraMissingMetrics = Math.max(
    0,
    missingMetricsCount - issueCounts.missing_metrics
  );

  score -= Math.min(extraPassive * 1, 5);
  score -= Math.min(extraFiller * 0.5, 3);
  score -= Math.min(extraWeakVerbs * 0.5, 4);
  // Missing metrics are not a grammar error.
// They are handled separately by ATS/content-quality scoring.

  if (Array.isArray(sentences) && sentences.length > 0) {
    let weakSentences = 0;
    let mediumSentences = 0;

    sentences.forEach((sentence) => {
      if (!sentence || typeof sentence !== "object") return;

      const impact =
        typeof sentence.impactScore === "number"
          ? sentence.impactScore
          : null;

      const level = String(sentence.level || "")
        .toLowerCase()
        .trim();

      if (
        level === "weak" ||
        (impact !== null && impact <= 4)
      ) {
        weakSentences++;
      } else if (
        level === "medium" ||
        (impact !== null && impact <= 7)
      ) {
        mediumSentences++;
      }
    });

    score -= Math.min(weakSentences * 1, 8);
    score -= Math.min(mediumSentences * 0.25, 3);
  }

  const pronounMatches = (
    String(resumeText || "").match(
      /\b(I|me|my|myself|we|our|us)\b/gi
    ) || []
  ).length;

  score -= Math.min(pronounMatches * 0.5, 2);

  if (
    typeof overallImpactScore === "number" &&
    Number.isFinite(overallImpactScore)
  ) {
    const impact = Math.max(
      0,
      Math.min(10, overallImpactScore)
    );

    if (impact < 3) {
      score -= 4;
    } else if (impact < 4) {
      score -= 3;
    } else if (impact < 5) {
      score -= 2;
    } else if (impact < 6) {
      score -= 1;
    }
  }

  return normalizeScores(score, 0, 100);
};
// ─── Tech Stack Proficiency ────────────────────────────────────────────────
const calculateTechStackProficiency = ({
  presentSkills = [],
  resumeText = "",
}) => {
  if (!Array.isArray(presentSkills) || presentSkills.length === 0) {
    return 50;
  }

  const lowerText = String(resumeText || "").toLowerCase();
  let verifiedCount = 0;

  presentSkills.forEach((skill) => {
    if (typeof skill === "string" && skill.trim().length > 0) {
      const cleanSkill = skill
        .split(":")[0]
        .split("(")[0]
        .trim()
        .toLowerCase();

      if (cleanSkill && lowerText.includes(cleanSkill)) {
        verifiedCount += 1;
      }
    }
  });

  const rawScore =
    (verifiedCount / presentSkills.length) * 100;

  return normalizeScores(rawScore, 0, 100);
};


// ─── Section Contributions ─────────────────────────────────────────────────
const calculateSectionContributions = (
  sectionsAnalysis = [],
  targetAtsScore = 70
) => {
  if (
    !Array.isArray(sectionsAnalysis) ||
    sectionsAnalysis.length === 0
  ) {
    return sectionsAnalysis;
  }

  const weights = {
    Strong: 15,
    Adequate: 10,
    Weak: 5,
    Minimal: 2,
  };

  const weightedSections = sectionsAnalysis.map((s) => {
    const baseWeight = weights[s.quality] || 8;

    return {
      ...s,
      tempWeight: baseWeight,
    };
  });

  const totalWeight = weightedSections.reduce(
    (sum, s) => sum + s.tempWeight,
    0
  );

  if (totalWeight === 0) {
    return sectionsAnalysis;
  }

  let runningTotal = 0;

  return weightedSections.map((s, idx, arr) => {
    if (idx === arr.length - 1) {
      const finalContrib = Math.max(
        0,
        targetAtsScore - runningTotal
      );

      const { tempWeight, ...cleanSection } = s;

      return {
        ...cleanSection,
        atsContribution: finalContrib,
      };
    }

    const scaled = Math.round(
      (s.tempWeight / totalWeight) * targetAtsScore
    );

    runningTotal += scaled;

    const { tempWeight, ...cleanSection } = s;

    return {
      ...cleanSection,
      atsContribution: scaled,
    };
  });
};


// ─── Job Role Matches ──────────────────────────────────────────────────────
const calculateJobRoleMatches = ({
  jobRoles = [],
  skillMatch = 70,
}) => {
  if (!Array.isArray(jobRoles) || jobRoles.length === 0) {
    return [];
  }

  const baseScore = normalizeScores(skillMatch, 0, 100);

  const stepOffsets = [0, 4, 10, 16, 22, 28];

  return jobRoles.map((role, idx) => {
    const offset =
      stepOffsets[idx] !== undefined
        ? stepOffsets[idx]
        : idx * 6;

    const match = normalizeScores(
      baseScore - offset,
      30,
      98
    );

    return {
      title:
        (role && role.title) ||
        "Relevant Role",
      icon:
        (role && role.icon) ||
        "💼",
      match,
    };
  });
};


// ─── Overall Score ─────────────────────────────────────────────────────────
const calculateOverallScore = ({
  atsScore = 0,
  skillMatch = 0,
  grammarScore = 0,
  techStackProficiency = 0,
}) => {
  const weightedScore =
    atsScore * 0.40 +
    skillMatch * 0.30 +
    grammarScore * 0.20 +
    techStackProficiency * 0.10;

  return normalizeScores(
    weightedScore,
    0,
    100
  );
};


// ─── Main Resume Evaluation ────────────────────────────────────────────────
const evaluateResume = (input = {}) => {
  const {
    resumeText = "",
    atsChecklist = [],
    sectionsAnalysis = [],
    presentSkills = [],
    missingSkills = [],
    grammarIssues = [],
    jobRoles = [],
    overallImpactScore = null,
    sentences = [],
    weakPatterns = {},
    grammarAnalysis = null,
  } = input;


  // Use explicitly supplied grammar issues first.
  // Otherwise fall back to grammarAnalysis.
  const gIssues =
    Array.isArray(grammarIssues) &&
    grammarIssues.length > 0
      ? grammarIssues
      : Array.isArray(
          grammarAnalysis?.grammarIssues
        )
      ? grammarAnalysis.grammarIssues
      : [];


  const gImpact =
    typeof overallImpactScore === "number"
      ? overallImpactScore
      : typeof grammarAnalysis?.overallImpactScore ===
        "number"
      ? grammarAnalysis.overallImpactScore
      : null;


  const gSentences =
    Array.isArray(sentences) &&
    sentences.length > 0
      ? sentences
      : Array.isArray(
          grammarAnalysis?.sentences
        )
      ? grammarAnalysis.sentences
      : [];


  const gPatterns =
    weakPatterns &&
    typeof weakPatterns === "object" &&
    Object.keys(weakPatterns).length > 0
      ? weakPatterns
      : grammarAnalysis?.weakPatterns || {};


  // 1. ATS
  const atsScore = calculateATSScore({
    resumeText,
    atsChecklist,
    sectionsAnalysis,
  });


  // 2. Skill Match
  const skillMatch = calculateSkillMatch({
    presentSkills,
    missingSkills,
  });


  // 3. Grammar
  // Uses YOUR CURRENT grammar scoring function.
  // No additional AI call is made here.
  const grammarScore = calculateGrammarScore({
    grammarIssues: gIssues,
    resumeText,
    overallImpactScore: gImpact,
    sentences: gSentences,
    weakPatterns: gPatterns,
  });


  // 4. Tech Stack
  const techStackProficiency =
    calculateTechStackProficiency({
      presentSkills,
      resumeText,
    });


  // 5. Overall
  const overallScore =
    calculateOverallScore({
      atsScore,
      skillMatch,
      grammarScore,
      techStackProficiency,
    });


  // 6. Section contributions
  const updatedSections =
    calculateSectionContributions(
      sectionsAnalysis,
      atsScore
    );


  // 7. Job role matches
  const updatedJobRoles =
    calculateJobRoleMatches({
      jobRoles,
      skillMatch,
    });


  const scores = {
    atsScore,
    skillMatch,
    grammarScore,
    techStackProficiency,
    overallScore,
    sectionsAnalysis: updatedSections,
    jobRoles: updatedJobRoles,
  };


  validateScores({
    atsScore,
    skillMatch,
    grammarScore,
    techStackProficiency,
    overallScore,
  });


  return scores;
};


// ─── Score Logging ─────────────────────────────────────────────────────────
const compareAndLogScores = (
  aiAnalysis = {},
  jsScores = {}
) => {
  console.log(
    "\n================================================"
  );

  console.log(
    "       PHASE 2 STEP 3: SCORE ENGINE LOG         "
  );

  console.log(
    "================================================"
  );

  console.log(
    `ATS Score              : ${
      jsScores.atsScore ?? "N/A"
    }`
  );

  console.log(
    `Grammar Score          : ${
      jsScores.grammarScore ?? "N/A"
    }`
  );

  console.log(
    `Skill Match            : ${
      jsScores.skillMatch ?? "N/A"
    }`
  );

  console.log(
    `Tech Stack Proficiency : ${
      jsScores.techStackProficiency ?? "N/A"
    }`
  );

  console.log(
    `Overall Score          : ${
      jsScores.overallScore ?? "N/A"
    }`
  );

  console.log(
    "================================================\n"
  );
};


// ─── Exports ───────────────────────────────────────────────────────────────
module.exports = {
  calculateATSScore,
  calculateSkillMatch,
  calculateGrammarScore,
  calculateTechStackProficiency,
  calculateSectionContributions,
  calculateJobRoleMatches,
  calculateOverallScore,
  normalizeScores,
  validateScores,
  evaluateResume,
  compareAndLogScores,
};
