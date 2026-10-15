const Resume = require("../models/resume");
const { parseResumeFile }       = require("../services/resumeParseService");
const { runFullAnalysis }        = require("../services/resumeAnalysisService");
const { callAI, extractJSON }    = require("../services/aiService");
const { buildGrammarPrompt, finalizeGrammarAnalysis } = require("../services/grammarService");
const scoringService             = require("../services/scoringService");

// ─── POST /api/resume/analyse ────────────────────────────────────────
exports.analyseResumeController = async (req, res) => {
  console.log("[CONTROLLER] 🚀 STARTING analyseResumeController");
  try {
    const { jobRole, jobDescription } = req.body;
    const file = req.file;

    if (!file) {
      console.log("[CONTROLLER] ❌ No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 1️⃣ Parse resume text from PDF / DOCX / Image
    console.log(`[CONTROLLER] 📄 Parsing resume file: "${file.originalname}" (mimetype: ${file.mimetype}, size: ${file.size} bytes)...`);
    const parseStart = Date.now();
    const resumeText = await parseResumeFile(file);
    console.log(`[CONTROLLER] ✅ Resume parsed in ${Date.now() - parseStart}ms | Extracted length: ${resumeText ? resumeText.length : 0} chars`);

    // 2️⃣ Run the full two-call AI analysis pipeline
    console.log("[CONTROLLER] ⏳ Calling runFullAnalysis...");
    const analysisStart = Date.now();
    const { analysis, fullChecklist } = await runFullAnalysis(
      resumeText,
      jobRole,
      jobDescription,
      file.mimetype
    );
    console.log(`[CONTROLLER] ✅ runFullAnalysis completed in ${Date.now() - analysisStart}ms`);

    // 3️⃣ Save analysis to MongoDB
    console.log("[CONTROLLER] 💾 Saving analysis record to MongoDB (Resume.create)...");
    const dbStart = Date.now();
    const savedResume = await Resume.create({
      userId: req.user.id,

      fileName:        file.originalname,
      atsScore:        analysis.atsScore,
      grammarScore:    analysis.grammarScore,
      skillMatch:      analysis.skillMatch,
      overallScore:    analysis.overallScore,
      experienceLevel: analysis.experienceLevel || "Fresher",
      presentSkills:   analysis.presentSkills   || [],
      missingSkills:   analysis.missingSkills   || [],
      jobRoles:        analysis.jobRoles         || [],
      grammarIssues:   analysis.grammarIssues    || [],
      suggestions:     analysis.suggestions      || [],
      projectsFeedback:analysis.projectsFeedback || [],
      certifications:  analysis.certifications   || [],
      sectionsAnalysis:analysis.sectionsAnalysis || [],

      // ── Resume X-Ray fields ────────────────────────────────────────
      rawExtractedText: resumeText,
      atsChecklist:     fullChecklist,

      // ── Grammar Analysis (already computed in full pipeline) ───────
      grammarAnalysis:  analysis.grammarAnalysis  || null,
    });
    console.log(`[CONTROLLER] ✅ Saved to MongoDB in ${Date.now() - dbStart}ms | Record ID: ${savedResume._id}`);

    // 4️⃣ Return full analysis + X-Ray data + saved record id to frontend
    console.log("[CONTROLLER] 📤 Sending JSON response back to frontend...");
    res.json({
      message: "Resume analysed successfully!",
      _id:      savedResume._id,
      fileName: file.originalname,
      ...analysis,
      // Override AI's atsChecklist with the full merged version (includes file-format check)
      atsChecklist:     fullChecklist,
      rawExtractedText: resumeText,
    });
    console.log("[CONTROLLER] ✅ JSON response sent successfully to frontend");
  } catch (err) {
    console.error("❌ [CONTROLLER ERROR] Resume analysis failed:", err.message);
    console.error("[CONTROLLER ERROR] Full stack trace:", err.stack);
    res.status(500).json({ message: err.message });
  }
};


// ─── GET /api/resume/history ─────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/resume/history/:id ─────────────────────────────────
exports.deleteOneHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const resume = await Resume.findById(id);
    if (!resume) return res.status(404).json({ message: "Analysis not found" });

    if (String(resume.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Resume.findByIdAndDelete(id);
    return res.status(200).json({ message: "Analysis deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/resume/history ──────────────────────────────────────
exports.clearAllHistory = async (req, res) => {
  try {
    const result = await Resume.deleteMany({ userId: req.user.id });
    return res.status(200).json({
      message:      "All history cleared successfully",
      deletedCount: result?.deletedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/resume/grammar-analysis ───────────────────────────────
exports.analyseGrammar = async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) return res.status(400).json({ message: "resumeId is required" });

    // 1️⃣ Find the resume and verify ownership
    const resume = await Resume.findById(resumeId);
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    if (String(resume.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const rawText = resume.rawExtractedText;
    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({
        message: "No extracted text found for this resume. Re-analyse it first.",
      });
    }

    // 1b️⃣ Short-circuit: return saved grammarAnalysis if it already exists
    if (
      resume.grammarAnalysis &&
      resume.grammarAnalysis.grammarScore !== undefined &&
      Array.isArray(resume.grammarAnalysis.sentences) &&
      resume.grammarAnalysis.sentences.length > 0
    ) {
      return res.json({
        message: "Grammar analysis complete",
        grammarAnalysis: resume.grammarAnalysis,
        grammarScore:    resume.grammarScore,
        overallScore:    resume.overallScore,
      });
    }

    // 2️⃣ Build the focused grammar prompt
    const grammarPrompt = buildGrammarPrompt(rawText);

    // 3️⃣ Call AI
    const aiText = await callAI(
      [
        {
          role: "system",
          content:
            "You are an expert resume grammar and impact language analyser. You always respond with valid JSON only, no markdown, no extra text.",
        },
        { role: "user", content: grammarPrompt },
      ],
      { temperature: 0.2, max_tokens: 5500 }
    );

    // 4️⃣ Parse + finalize (compute deterministic grammarScore, fix totalIssues, reconcile sentence whitespace)
    const grammarAnalysis = finalizeGrammarAnalysis(extractJSON(aiText), rawText);

    // 5️⃣ Recalculate techStackProficiency & overallScore with updated authoritative grammarScore
    const techStackProficiency = scoringService.calculateTechStackProficiency({
      presentSkills: resume.presentSkills || [],
      resumeText: rawText,
    });

    const updatedOverallScore = scoringService.calculateOverallScore({
      atsScore:             resume.atsScore             || 0,
      skillMatch:           resume.skillMatch           || 0,
      grammarScore:         grammarAnalysis.grammarScore || 0,
      techStackProficiency: techStackProficiency         || 0,
    });

    // Attach updated overallScore to grammarAnalysis object as well for extra consistency
    grammarAnalysis.overallScore = updatedOverallScore;

    // 6️⃣ Save grammarAnalysis + sync root-level grammarScore AND overallScore together
    resume.grammarAnalysis = grammarAnalysis;
    resume.grammarScore    = grammarAnalysis.grammarScore; // authoritative grammar score
    resume.overallScore    = updatedOverallScore;         // synchronized overall score
    await resume.save();

    // 7️⃣ Return the grammar analysis + synchronized scores
    res.json({
      message: "Grammar analysis complete",
      grammarAnalysis,
      grammarScore: resume.grammarScore,
      overallScore: resume.overallScore,
    });
  } catch (err) {
    console.error("❌ Grammar analysis error:", err);
    res.status(500).json({ message: err.message });
  }
};

