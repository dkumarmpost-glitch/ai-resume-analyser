const { callAI, callGrammarAI, extractJSON } = require("./aiService");
const { analyseCoreResume, analyseDeepResume } = require("../utils/AIprompts");
const { buildGrammarPrompt } = require("./grammarService");
const { finalizeGrammarAnalysis } = require("./grammarService");
const { normalizeSkills } = require("./skillsService");
const {
  reconcileAtsSections,
  runAtsSanityCheck,
  buildFullChecklist,
} = require("./atsService");
const scoringService = require("./scoringService");

const SYSTEM_PROMPT =
  "You are an expert HR and ATS resume analyser. Respond with valid JSON only, no markdown, no extra text.";

const GRAMMAR_SYSTEM_PROMPT =
  "You are an expert resume grammar and impact language analyser. Respond with valid JSON only, no markdown, no extra text.";

const runFullAnalysis = async (
  resumeText,
  jobRole,
  jobDescription,
  mimetype
) => {
  console.log(
    `[ANALYSIS SERVICE] 🚀 STARTING runFullAnalysis | Resume Text Length: ${
      resumeText ? resumeText.length : 0
    } chars`
  );

  try {
    // ================================================================
    // CALL 1 — EXISTING API: CORE ANALYSIS
    // ================================================================

    const prompt1 = analyseCoreResume(
      resumeText,
      jobRole,
      jobDescription
    );

    console.log(
      `[ANALYSIS SERVICE] 📝 Call 1 prompt size: ${prompt1.length} chars`
    );

    const rawCore = await callAI(
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt1,
        },
      ],
      {
        temperature: 0.3,
        max_tokens: 900,
      }
    );

    const coreAnalysis = extractJSON(rawCore);

    // ================================================================
    // CALL 2 — EXISTING API: DEEP / ATS ANALYSIS
    // ================================================================

    const prompt2 = analyseDeepResume(resumeText);

    console.log(
      `[ANALYSIS SERVICE] 📝 Call 2 prompt size: ${prompt2.length} chars`
    );

    const rawDeep = await callAI(
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt2,
        },
      ],
      {
        temperature: 0.3,
        max_tokens: 900,
      }
    );

    const deepAnalysis = extractJSON(rawDeep);

    // ================================================================
    // CALL 3 — NEW GRAMMAR API: DEDICATED GRAMMAR ANALYSIS
    // ================================================================

    const grammarPrompt = buildGrammarPrompt(resumeText);

    console.log(
      `[ANALYSIS SERVICE] 📝 Grammar prompt size: ${grammarPrompt.length} chars`
    );

    const rawGrammar = await callGrammarAI(
      [
        {
          role: "system",
          content: GRAMMAR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: grammarPrompt,
        },
      ],
      {
        temperature: 0.2,
        max_tokens: 5500,
      }
    );

    const grammarAnalysis = finalizeGrammarAnalysis(
      extractJSON(rawGrammar),
      resumeText
    );

    // ================================================================
    // MERGE ALL QUALITATIVE RESULTS
    // ================================================================

    const analysis = {
      ...coreAnalysis,
      ...deepAnalysis,

      // Grammar comes exclusively from the dedicated grammar API.
      grammarAnalysis,

      // Authoritative grammar score comes from JS scoring.
      grammarScore: grammarAnalysis.grammarScore,
    };

    // ================================================================
    // NORMALIZE SKILLS
    // ================================================================

    normalizeSkills(analysis);

    // ================================================================
    // BUILD ATS CHECKLIST
    // ================================================================

    const fullChecklist = buildFullChecklist(
      analysis.atsChecklist,
      mimetype
    );

    // ================================================================
    // JS SCORING — SINGLE SOURCE OF TRUTH
    // ================================================================

    const jsScores = scoringService.evaluateResume({
      resumeText,

      atsChecklist: fullChecklist,

      sectionsAnalysis: analysis.sectionsAnalysis,

      presentSkills: analysis.presentSkills,

      missingSkills: analysis.missingSkills,

      // IMPORTANT:
      // Use the dedicated grammar analysis from Call 3.
      grammarIssues: grammarAnalysis.grammarIssues,

      overallImpactScore:
        grammarAnalysis.overallImpactScore,

      sentences: grammarAnalysis.sentences,

      weakPatterns: grammarAnalysis.weakPatterns,

      jobRoles: analysis.jobRoles,

      grammarAnalysis,
    });

    // ================================================================
    // OVERRIDE ALL NUMERIC SCORES WITH JS SCORES
    // ================================================================

    analysis.atsScore = jsScores.atsScore;

    analysis.grammarScore = jsScores.grammarScore;

    analysis.skillMatch = jsScores.skillMatch;

    analysis.techStackProficiency =
      jsScores.techStackProficiency;

    analysis.overallScore =
      jsScores.overallScore;

    analysis.sectionsAnalysis =
      jsScores.sectionsAnalysis;

    analysis.jobRoles =
      jsScores.jobRoles;

    // Keep the authoritative score inside grammarAnalysis too.
    analysis.grammarAnalysis.grammarScore =
      jsScores.grammarScore;

    analysis.grammarAnalysis.overallScore =
      jsScores.overallScore;

    // ================================================================
    // RECONCILE ATS SECTION CONTRIBUTIONS
    // ================================================================

    if (
      Array.isArray(analysis.sectionsAnalysis) &&
      analysis.sectionsAnalysis.length > 0
    ) {
      analysis.sectionsAnalysis =
        reconcileAtsSections(
          analysis.sectionsAnalysis,
          analysis.atsScore
        );
    }

    // ================================================================
    // ATS SANITY CHECK
    // ================================================================

    runAtsSanityCheck(
      analysis.sectionsAnalysis
    );

    // ================================================================
    // VALIDATE FINAL SCORES
    // ================================================================

    const valid =
      scoringService.validateScores({
        atsScore: analysis.atsScore,
        grammarScore: analysis.grammarScore,
        skillMatch: analysis.skillMatch,
        techStackProficiency:
          analysis.techStackProficiency,
        overallScore: analysis.overallScore,
      });

    if (!valid) {
      console.warn(
        "[ANALYSIS SERVICE WARNING] Computed JS scores failed validation check"
      );
    }

    // ================================================================
    // DEBUG LOG
    // ================================================================

    console.log("\n======== FINAL ANALYSIS ========");
    console.log(
      `ATS Score         : ${analysis.atsScore}`
    );
    console.log(
      `Grammar Score     : ${analysis.grammarScore}`
    );
    console.log(
      `Skill Match       : ${analysis.skillMatch}`
    );
    console.log(
      `Tech Stack        : ${analysis.techStackProficiency}`
    );
    console.log(
      `Overall Score     : ${analysis.overallScore}`
    );
    console.log(
      `Grammar Issues    : ${
        analysis.grammarAnalysis?.grammarIssues?.length || 0
      }`
    );
    console.log(
      `Sentences         : ${
        analysis.grammarAnalysis?.sentences?.length || 0
      }`
    );
    console.log("===============================\n");

    return {
      analysis,
      fullChecklist,
    };
  } catch (err) {
    console.error(
      "[ANALYSIS SERVICE ERROR] ❌ runFullAnalysis FAILED:",
      err.message
    );
    console.error(err.stack);
    throw err;
  }
};

module.exports = {
  runFullAnalysis,
};
