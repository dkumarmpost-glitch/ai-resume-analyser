const scoringService = require("../services/scoringService");

console.log("=== Testing Phase 2A scoringService ===");

const sampleInput = {
  resumeText: "Experienced Software Engineer with 5 years experience. Managed 10+ projects and reduced latency by 30%. Skills: Node.js, React, MongoDB.",
  atsChecklist: [
    { check: "Tables or Columns", passed: true },
    { check: "Special Characters", passed: true },
    { check: "Standard Section Headers", passed: true },
    { check: "Contact Info", passed: true },
    { check: "File Format Risk", passed: true }
  ],
  sectionsAnalysis: [
    { section: "Experience", quality: "Strong", note: "Great metrics", atsContribution: 25 },
    { section: "Education", quality: "Adequate", note: "B.S. CS", atsContribution: 20 },
    { section: "Skills", quality: "Strong", note: "Relevant tech", atsContribution: 25 },
    { section: "Projects", quality: "Adequate", note: "Good projects", atsContribution: 20 }
  ],
  presentSkills: ["Node.js", "React", "MongoDB", "Express", "JavaScript"],
  missingSkills: ["Docker", "Kubernetes"],
  grammarIssues: [{ text: "their", fix: "there" }],
};

const jsScores = scoringService.evaluateResume(sampleInput);

const mockAiAnalysis = {
  atsScore: 92,
  grammarScore: 95,
  skillMatch: 75,
  overallScore: 88,
};

scoringService.compareAndLogScores(mockAiAnalysis, jsScores);

console.log("Verification checks:");
console.log("1. validateScores:", scoringService.validateScores(jsScores) ? "PASSED" : "FAILED");
console.log("2. Section contributions recalculation:");
const recontrib = scoringService.calculateSectionContributions(sampleInput.sectionsAnalysis, jsScores.atsScore);
const contribSum = recontrib.reduce((acc, s) => acc + s.atsContribution, 0);
console.log(`   Target ATS: ${jsScores.atsScore}, Sum of contributions: ${contribSum} ->`, contribSum === jsScores.atsScore ? "PASSED" : "FAILED");
