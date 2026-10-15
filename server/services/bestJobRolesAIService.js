/**
 * bestJobRolesAIService.js
 *
 * Single focused AI call: analyse resume text and return
 * the best matching job roles with match percentages and reasons.
 *
 * Uses the existing callAI / extractJSON infrastructure from aiService.js.
 * Does NOT call runFullAnalysis — this is intentionally minimal (1 AI call).
 */

const { callAI, extractJSON } = require("./aiService");

const SYSTEM_PROMPT =
  "You are an expert career counsellor and resume analyst. " +
  "Respond with valid JSON only — no markdown, no extra text.";

/**
 * Build the focused job-role matching prompt.
 * @param {string} resumeText
 * @returns {string}
 */
function buildBestJobRolesPrompt(resumeText) {
  // Trim to avoid sending an excessively large prompt for this focused task.
  const trimmed = resumeText.slice(0, 6000);

  return `Analyse the following resume and determine the 5–6 job roles that best match this candidate's actual profile.

Base your analysis on:
- Technical skills and tools explicitly mentioned
- Projects and technologies used
- Work experience, internships, or freelance work
- Education and certifications
- Overall technical depth and domain focus

Return ONLY a JSON object in this exact structure (no extra text):
{
  "recommendedRoles": [
    {
      "role": "Job Title Here",
      "matchPercentage": 87,
      "reason": "One concise sentence explaining why this role fits."
    }
  ]
}

Rules:
- Limit to exactly 5–6 roles.
- matchPercentage must be a number from 1–100.
- Order by matchPercentage descending (highest first).
- Use real, industry-standard job titles.
- Do NOT invent skills or experience not present in the resume.
- reason must be ≤ 120 characters.

RESUME TEXT:
${trimmed}`;
}

/**
 * Analyse resume text and return recommended job roles.
 * @param {string} resumeText
 * @returns {Promise<Array<{role: string, matchPercentage: number, reason: string}>>}
 */
async function recommendJobRoles(resumeText) {
  console.log("[BEST JOB ROLES AI] 🚀 Starting focused job-role AI call...");

  const prompt = buildBestJobRolesPrompt(resumeText);

  const raw = await callAI(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: prompt },
    ],
    { temperature: 0.3, max_tokens: 900 }
  );

  const parsed = extractJSON(raw);

  const roles = Array.isArray(parsed?.recommendedRoles)
    ? parsed.recommendedRoles
    : [];

  // Sanitise each role entry
  const sanitised = roles
    .filter((r) => r && typeof r.role === "string" && r.role.trim())
    .slice(0, 6)
    .map((r) => ({
      role:            String(r.role).trim(),
      matchPercentage: Math.min(100, Math.max(1, parseInt(r.matchPercentage, 10) || 70)),
      reason:          String(r.reason || "").slice(0, 140).trim(),
    }));

  console.log(`[BEST JOB ROLES AI] ✅ ${sanitised.length} roles recommended`);
  return sanitised;
}

module.exports = { recommendJobRoles };
