const { finalizeGrammarAnalysis, computeGrammarScore } = require("../services/grammarService");
const scoringService = require("../services/scoringService");

console.log("=========================================");
console.log("🧪 RUNNING GRAMMAR VERIFICATION TESTS...");
console.log("=========================================");

const sampleRawText = `Adaptable BTech CSE student with strong background in software development. Experienced in building responsive web applications using React and Node.js. Successfully led team projects and delivered high-quality code.`;

const sampleIssues = [
  { original: "led team projects", corrected: "spearheaded team projects", type: "weak_verb", text: "led team projects", fix: "spearheaded team projects" },
  { original: "delivered high-quality", corrected: "delivered scalable", type: "missing_metrics", text: "delivered high-quality", fix: "delivered scalable" },
  { original: "BTech", corrected: "B.Tech", type: "spelling", text: "BTech", fix: "B.Tech" },
  { original: "was built by me", corrected: "I built", type: "passive_voice", text: "was built by me", fix: "I built" },
];

// Test 1: Score Synchronization
const sampleGa = {
  overallImpactScore: 6.5,
  sentences: [
    {
      original: "AdaptableBTechCSEstudentwithstrongbackgroundinsoftwaredevelopment.",
      impactScore: 4,
      level: "weak",
      issues: ["Lack of metrics"],
      powerRewrite: "Adaptable BTech CSE student who increased application throughput by 40%."
    }
  ],
  grammarIssues: sampleIssues,
};

const finalized = finalizeGrammarAnalysis(sampleGa, sampleRawText);
const scoreFromScoringService = scoringService.calculateGrammarScore({
  grammarIssues: sampleIssues,
  resumeText: sampleRawText,
  overallImpactScore: finalized.overallImpactScore,
  sentences: finalized.sentences,
});

console.log(`\n1️⃣ Score Synchronization Test:`);
console.log(`   scoringService.calculateGrammarScore : ${scoreFromScoringService}`);
console.log(`   grammarService.finalizeGrammarAnalysis: ${finalized.grammarScore}`);
const test1Pass = scoreFromScoringService === finalized.grammarScore;
console.log(`   RESULT: ${test1Pass ? "✅ PASS" : "❌ FAIL"}`);

// Test 2: Issue Categories & Backward Compatibility Test
console.log(`\n2️⃣ Issue Categories & Field Normalization Test:`);
const allTypesPresent = finalized.grammarIssues.every(
  (iss) => iss.original && iss.corrected && iss.type && iss.text && iss.fix
);
console.log(`   Normalized fields check: ${allTypesPresent ? "All fields present" : "Missing fields"}`);
console.log(`   RESULT: ${allTypesPresent ? "✅ PASS" : "❌ FAIL"}`);

// Test 3: Whitespace Reconciliation Test
console.log(`\n3️⃣ Sentence Whitespace Reconciliation Test:`);
const reconciledSentence = finalized.sentences[0].original;
console.log(`   Original extracted sentence text: "${sampleRawText.split('.')[0]}."`);
console.log(`   Reconciled sentence in HeatMap: "${reconciledSentence}"`);
const test3Pass = reconciledSentence === "Adaptable BTech CSE student with strong background in software development.";
console.log(`   RESULT: ${test3Pass ? "✅ PASS" : "❌ FAIL"}`);

console.log("\n=========================================");
if (test1Pass && allTypesPresent && test3Pass) {
  console.log("🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
} else {
  console.error("❌ VERIFICATION TESTS FAILED!");
  process.exit(1);
}
console.log("=========================================\n");
