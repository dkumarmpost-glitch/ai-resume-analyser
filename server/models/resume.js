const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName: String,
  atsScore: Number,
  grammarScore: Number,
  skillMatch: Number,
  overallScore: Number,
  experienceLevel: String,
  presentSkills: [String],
  missingSkills: [String],
  jobRoles: [Object],
  suggestions: [String],
  grammarIssues: [Object],
  projectsFeedback: [String],
  certifications: [String],
  sectionsAnalysis: [Object],
  // ── Resume X-Ray ───────────────────────────────────────────────────
  rawExtractedText: String,        // the raw text extracted from the file
  atsChecklist: [Object],          // structural ATS parsability checklist items
  // ── Grammar Analysis ────────────────────────────────────────────────
  grammarAnalysis: Object,         // rich grammar/impact analysis from dedicated endpoint
}, { timestamps: true });

module.exports = mongoose.model("Resume", resumeSchema);