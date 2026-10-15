// ─── Shared output rules (defined once) ──────────────────────────────────────
const OUTPUT_RULES = `OUTPUT RULES:
- Return ONLY valid JSON matching the schema exactly. Do not add, remove, or rename fields.
- All text values: max 120 characters.
- Arrays marked [MAX N] must have AT MOST N items.
- If information is absent, return null or an empty array instead of inventing values.`;

// ─── Call 1: Core qualitative evaluation ─────────────────────────────────────
const analyseCoreResume = (resumeText, jobRole, jobDescription) => {
  return `Infer the candidate's profession from the resume. You are an expert ATS specialist and HR consultant.

RESUME:
---
${resumeText}
---
Job Role: ${jobRole || 'Infer from resume'}
Job Description: ${jobDescription || 'Use standard requirements for detected profession'}

${OUTPUT_RULES}

EVALUATE:
1. experienceLevel: Fresher | Junior | Mid-Level | Senior | Lead/Principal
2. presentSkills: skills explicitly found in resume
3. missingSkills: key skills for target role not found in resume
4. jobRoles: top 5-6 matching job titles with emoji icons
5. grammarIssues: detect every issue found. Each issue MUST use exactly one of:
   spelling | punctuation | tense | passive_voice | filler_phrase | weak_verb | missing_metrics
6. suggestions: actionable improvement tips

OUTPUT JSON:
{
  "experienceLevel": "",
  "presentSkills": ["skill1","skill2"],
  "missingSkills": ["m1","m2","m3","m4","m5"],
  "jobRoles": [{"title":"","icon":""}],
  "grammarIssues": [{}],
  "suggestions": ["s1","s2"]
}

LIMITS: presentSkills [MAX 20], missingSkills [MAX 6], jobRoles [MIN 5, MAX 6], grammarIssues [MIN 4, MAX 5], suggestions [MIN 6, MAX 7].`;
};

// ─── Call 2: Deep section analysis + ATS checklist ───────────────────────────
const analyseDeepResume = (resumeText) => {
  return `Infer the candidate's profession from the resume. You are an expert ATS specialist and HR consultant.

RESUME:
---
${resumeText}
---

${OUTPUT_RULES}

SECTIONS ANALYSIS:
- List every section that ACTUALLY exists in the resume. No invented, no omitted.
- Each entry: section, quality, note (<=100 chars), details or null.
- quality: Strong | Adequate | Weak | Minimal

ITEM-LEVEL FLAGS (for any section with items):
- Per item: unresolvedFlags [MAX 3], use only:
  'missing quantified results' | 'impact not specified' | 'vague description' | 'missing dates' | 'unclear scope'

QUALITY RULE:
- If most items have unresolved flags: quality MUST NOT be 'Strong'.

DETAILS BY SECTION TYPE:

Skills:
{ groups: [MAX 4] { category: '', items: [MAX 5] } }

Projects/Achievements/Portfolio/Campaigns:
{ items: [MAX 4] { name: '', impact: 'metric or Not specified', unresolvedFlags: [] } }

Education:
{ relevance: 'High | Medium | Low', gpa: 'value or null' }

Employment/Experience/Work History:
{ totalYears: '', growthTrajectory: 'Progressive | Lateral | Mixed | Single Role',
  items: [MAX 4] { name: '', dateRange: 'value or Not specified', unresolvedFlags: [] } }

Certifications/Licenses:
{ items: [MAX 4] { name: '', industryRecognized: true/false,
  relevance: 'High | Medium | Low', unresolvedFlags: [] } }

Languages:
{ items: [MAX 5] { language: '', proficiency: 'Native | Fluent | Professional | Conversational | Basic',
  unresolvedFlags: [] } }

All other sections: details null

ATS CHECKLIST (exactly 4 items, structure-only, never profession-based):
passed=true only if the condition is satisfied. Otherwise passed=false.

1. 'Tables or Columns Detected'
   passed=true if text flows logically with no layout artifacts.
   passed=false if scrambled text, unusual spacing, or content jumping topics mid-line detected.

2. 'Special Characters / Icons'
   passed=true if no icon-only labels or broken characters found.
   passed=false if unusual Unicode bullets, broken chars, or contact fields with no text label detected.

3. 'Standard Section Headers'
   passed=true if all headers are conventional (Summary, Experience, Education, Skills, Certifications, Projects, Languages).
   passed=false if one or more unconventional headers found (e.g. 'My Journey', 'What I Bring').

4. 'Contact Info Placement'
   passed=true if contact info (name, phone, email) appears in readable body text.
   passed=false if contact info is isolated, absent, or likely in a PDF header ATS skips.

OUTPUT JSON:
{
  "sectionsAnalysis": [
    { "section": "", "quality": "", "note": "", "details": null }
  ],
  "projectsFeedback": ["feedback"],
  "certifications": ["evaluation"],
  "atsChecklist": [
    {"check":"Tables or Columns Detected","passed":true,"detail":""},
    {"check":"Special Characters / Icons","passed":true,"detail":""},
    {"check":"Standard Section Headers","passed":true,"detail":""},
    {"check":"Contact Info Placement","passed":true,"detail":""}
  ]
}

LIMITS: projectsFeedback [MAX 5], certifications [MAX 5], atsChecklist [EXACTLY 4].`;
};

module.exports = { analyseCoreResume, analyseDeepResume };