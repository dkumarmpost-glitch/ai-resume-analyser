const oldPrompt = `You are an expert resume grammar and impact language analyser.
Analyse the following resume text carefully and return ONLY valid JSON with this exact structure:
{
  "overallImpactScore": number (0-10, average of all sentence impact scores),
  "sentences": [
    {
      "original": string (the original sentence or bullet point, quoted EXACTLY with all spaces intact; NEVER remove or collapse spaces between words),
      "impactScore": number (0-10),
      "level": "weak" | "medium" | "strong",
      "issues": [string] (list of SPECIFIC problems found in this sentence — empty array if none),
      "powerRewrite": string | null (strong rewrite with action verb + specific detail + quantified result; ONLY if impactScore < 6, else null)
    }
  ],
  "grammarIssues": [
    {
      "original": string (the exact problematic phrase or word from the resume),
      "corrected": string (the corrected version),
      "type": "spelling" | "punctuation" | "tense" | "passive_voice" | "filler_phrase" | "weak_verb" | "missing_metrics"
    }
  ],
  "weakPatterns": {
    "passiveVoiceCount": number,
    "fillerPhraseCount": number,
    "weakVerbCount": number,
    "missingMetricsCount": number
  }
}

Rules:
- Sentence impact: Evaluate each sentence using grammar, clarity, professional wording, strong action verbs, specificity, quantified achievements, business impact, and overall resume strength.
  0-4 = weak (vague, passive voice, missing metrics, weak verbs, or poor impact), 5-7 = medium (clear but lacks strong metrics or high business impact), 8-10 = strong (action verb, specific achievement, quantified result, professional language).
- powerRewrite: ONLY for impactScore < 6; maximum 15 total across all sentences
- grammarIssues: list EVERY real grammar, spelling, punctuation, tense inconsistency, passive voice instance, filler phrase, weak verb, and missing metric found in the resume — be thorough, do NOT miss any. Categorize every item accurately using one of the exact type strings provided.
- "original" in sentences MUST preserve exact spaces between words. Do NOT concatenate words together.
- weakPatterns counts must count ALL instances in the full resume text, not just those in grammarIssues
- Return ONLY raw JSON. No markdown, no code fences, no explanation.

Resume text:
`;

const newPromptTemplate = `Analyse the resume text and return ONLY raw JSON matching this schema:
{
  "overallImpactScore": number, // 0-10 avg of sentence impact scores
  "sentences": [
    {
      "original": "string", // quote sentence/bullet exactly; preserve all spaces
      "impactScore": number, // 0-10 (0-4 weak, 5-7 medium, 8-10 strong)
      "level": "weak" | "medium" | "strong",
      "issues": ["string"], // specific problems, or [] if none
      "powerRewrite": "string | null" // action verb + detail + metric; ONLY if impactScore < 6 (max 15), else null
    }
  ],
  "grammarIssues": [
    {
      "original": "string", // exact problematic phrase
      "corrected": "string", // corrected phrase
      "type": "spelling" | "punctuation" | "tense" | "passive_voice" | "filler_phrase" | "weak_verb" | "missing_metrics"
    }
  ],
  "weakPatterns": {
    "passiveVoiceCount": number, // total count in full resume
    "fillerPhraseCount": number,
    "weakVerbCount": number,
    "missingMetricsCount": number
  }
}

Rules:
- Thoroughly detect all grammar, spelling, punctuation, tense, passive voice, filler phrase, weak verb, and missing metric issues.
- weakPatterns counts must cover the full resume text.

Resume text:
`;

function approxTokens(str) {
  const wordsAndPunct = str.match(/[\w']+|[^\w\s]+/g) || [];
  return wordsAndPunct.length;
}

console.log("OLD PROMPT STATS:");
console.log("Chars:", oldPrompt.length);
console.log("Words/Tokens (approx):", approxTokens(oldPrompt));

console.log("\nNEW PROMPT STATS:");
console.log("Chars:", newPromptTemplate.length);
console.log("Words/Tokens (approx):", approxTokens(newPromptTemplate));

const charReduction = ((oldPrompt.length - newPromptTemplate.length) / oldPrompt.length * 100).toFixed(2);
const tokenReduction = ((approxTokens(oldPrompt) - approxTokens(newPromptTemplate)) / approxTokens(oldPrompt) * 100).toFixed(2);

console.log(`\nReduction: ${charReduction}% chars, ${tokenReduction}% tokens`);
