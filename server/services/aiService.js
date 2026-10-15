const OpenAI = require("openai");

// ─── Main Groq client ────────────────────────────────────────────────
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 180000,
});

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// ─── Dedicated Grammar Groq client ──────────────────────────────────
const grammarClient = new OpenAI({
  apiKey: process.env.GROQ_GRAMMAR_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 180000,
});

const GRAMMAR_MODEL =
  process.env.GROQ_GRAMMAR_MODEL || MODEL;


// ─── Helper: Extract & parse JSON ────────────────────────────────────
const extractJSON = (text) => {
  console.log(
    `[AI SERVICE] 🔍 Extracting JSON from response (length: ${
      text ? text.length : 0
    } chars)...`
  );

  if (!text) {
    throw new Error("Empty response from Groq");
  }

  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in Groq response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      "Failed to parse Groq response as JSON: " + err.message
    );
  }
};


// ─── Main AI call ────────────────────────────────────────────────────
const callAI = async (messages, options = {}) => {
  const promptSize = messages.reduce(
    (total, message) =>
      total + (message.content ? message.content.length : 0),
    0
  );

  console.log(
    `[AI SERVICE] 🚀 Main Groq request | Model: ${MODEL} | Prompt: ${promptSize} chars`
  );

  const payload = {
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 4096,
    reasoning_effort: "none",
    response_format: {
      type: "json_object",
    },
  };

  const completion = await client.chat.completions.create(payload);

  return completion.choices?.[0]?.message?.content || "";
};


// ─── Dedicated Grammar AI call ───────────────────────────────────────
const callGrammarAI = async (messages, options = {}) => {
  const promptSize = messages.reduce(
    (total, message) =>
      total + (message.content ? message.content.length : 0),
    0
  );

  console.log(
    `[GRAMMAR AI] 🚀 Grammar Groq request | Model: ${GRAMMAR_MODEL} | Prompt: ${promptSize} chars`
  );

  const payload = {
    model: GRAMMAR_MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 5500,
    reasoning_effort: "none",
    response_format: {
      type: "json_object",
    },
  };

  const completion =
    await grammarClient.chat.completions.create(payload);

  const content =
    completion.choices?.[0]?.message?.content || "";

  console.log(
    `[GRAMMAR AI] ✅ Grammar response received | ${content.length} chars`
  );

  return content;
};


module.exports = {
  callAI,
  callGrammarAI,
  extractJSON,
  MODEL,
  GRAMMAR_MODEL,
};

