/**
 * bestJobRolesController.js
 *
 * Handles POST /api/resume/best-job-roles
 *
 * Flow:
 *  1. Auth (via authMiddleware in route)
 *  2. Parse uploaded resume file (reuses existing parseResumeFile)
 *  3. Run focused AI analysis → recommended roles
 *  4. Search Adzuna for real jobs for the top roles
 *  5. Return combined result to frontend
 *
 * Does NOT:
 *  - Run the full analysis pipeline (runFullAnalysis)
 *  - Save anything to the Resume collection
 *  - Affect history, ATS score, grammar, or scoring logic
 */
const Resume = require("../models/resume");
const { parseResumeFile }  = require("../services/resumeParseService");
const { recommendJobRoles } = require("../services/bestJobRolesAIService");
const { searchJobsByRoles } = require("../services/jobSearchService");

// ─── POST /api/resume/best-job-roles ────────────────────────────────────────
exports.bestJobRolesController = async (req, res) => {
  console.log("[BEST JOB ROLES] 🚀 Starting best-job-roles analysis");

  try {
    // 1️⃣ File presence check (multer already validated type & size)
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const { resumeId } = req.body;

    // 2️⃣ Parse resume text (reuses existing service — no duplication)
    console.log(`[BEST JOB ROLES] 📄 Parsing: "${file.originalname}" (${file.size} bytes)`);
    const parseStart = Date.now();
    const resumeText = await parseResumeFile(file);
    console.log(`[BEST JOB ROLES] ✅ Parsed in ${Date.now() - parseStart}ms | ${resumeText?.length ?? 0} chars`);

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        message: "Could not extract enough text from the resume. Please try a different file format.",
      });
    }

    // 3️⃣ Single focused AI call → recommended roles
    const aiStart = Date.now();
    const recommendedRoles = await recommendJobRoles(resumeText);
    console.log(`[BEST JOB ROLES] ✅ AI done in ${Date.now() - aiStart}ms`);

    if (!recommendedRoles.length) {
      return res.status(422).json({
        message: "Could not determine job roles from this resume. Please ensure the resume has readable content.",
      });
    }

    // 4️⃣ Job search — use top 3 roles to keep response fast & relevant
    const topRoles = recommendedRoles.slice(0, 3).map((r) => r.role);
    const jobStart = Date.now();
    const jobsByRole = await searchJobsByRoles(topRoles, 4);
    console.log(`[BEST JOB ROLES] ✅ Job search done in ${Date.now() - jobStart}ms`);
    // 5️⃣ Save Best Job Roles into the existing History record
if (resumeId) {
  const resume = await Resume.findById(resumeId);

  if (!resume) {
    return res.status(404).json({
      message: "Resume history record not found",
    });
  }

  if (String(resume.userId) !== String(req.user.id)) {
    return res.status(403).json({
      message: "Not authorized",
    });
  }

  resume.bestJobRoles = {
    recommendedRoles,
    jobsByRole,
  };

  await resume.save();

  console.log(
    `[BEST JOB ROLES] 💾 Saved to existing history record: ${resume._id}`
  );
}

    // 5️⃣ Return combined result
    res.json({
      message:          "Best job roles analysis complete",
      recommendedRoles,
      jobsByRole,       // [{role, jobs: [{title, company, location, description, jobUrl, postedDate, salary, employmentType}]}]
    });

    console.log("[BEST JOB ROLES] ✅ Response sent");
  } catch (err) {
    console.error("[BEST JOB ROLES] ❌ Error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: err.message || "Best job roles analysis failed." });
  }
};
