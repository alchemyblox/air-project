// server.js — Gemini Vision version (robust JSON parsing + minor hardening)
// Fixed regex issue (hyphen escaped) and small defensive tweaks.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "12mb" }));

// Rate limit to avoid abuse
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    standardHeaders: true
  })
);

// --- Gemini Setup ---
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load the vision-capable model (you can change this if needed)
const MODEL_ID = "gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: MODEL_ID });

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/* ---------- Helper: extract JSON from possibly noisy model text ---------- */
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;

  // 1) remove common markdown/code fences (```json ... ``` or ``` ... ```)
  let cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 2) Sometimes model prefixes with "json" or "JSON" — remove that
  if (cleaned.toLowerCase().startsWith("json")) {
    cleaned = cleaned.slice(4).trim();
  }

  // 3) Find the first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let candidate = match[0].trim();

  // 4) Try strict parse
  try {
    return JSON.parse(candidate);
  } catch (err) {
    // 5) Try a tolerant, best-effort cleanup:
    //    - ensure keys are quoted
    //    - replace single quotes with double quotes (naive)
    //    - remove trailing commas
    try {
      // Escape hyphen properly in character class; quote unquoted keys
      let fixed = candidate.replace(/([,{]\s*)([A-Za-z0-9_\-\$]+)\s*:/g, '$1"$2":'); // quote keys
      fixed = fixed.replace(/'/g, '"');
      fixed = fixed.replace(/,\s*}/g, "}");
      fixed = fixed.replace(/,\s*]/g, "]");
      return JSON.parse(fixed);
    } catch (err2) {
      return null;
    }
  }
}

/* ---------- Identify route ---------- */
app.post("/identify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    // small sanity check on base64 size
    if (typeof image !== "string" || image.length < 200) {
      return res.status(400).json({ error: "Invalid image payload" });
    }

    const prompt = `
You are an image identification AI.
Analyze the attached image and RETURN ONLY a single JSON object EXACTLY in this shape:

{
  "name": "<best single label>",
  "description": "<comma-separated alternative labels>",
  "confidences": [{"name":"...","prob":0.95}]
}

Do NOT include explanations, headings, or markdown fences. Output must be valid JSON only.
`;

    // Call model (timeout protection via Promise.race)
    const TIMEOUT_MS = 20000;
    const p = model.generateContent([
      { inlineData: { data: image, mimeType: "image/jpeg" } },
      prompt
    ]);
    const rawResp = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error("model-timeout")), TIMEOUT_MS))
    ]);

    // robustly extract text from possible SDK shapes
    let text = "";
    try {
      if (rawResp?.response?.text) {
        text = rawResp.response.text().trim();
      } else if (typeof rawResp === "string") {
        text = rawResp.trim();
      } else if (rawResp?.output?.[0]?.content) {
        text = String(rawResp.output[0].content).trim();
      } else if (rawResp?.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = rawResp.candidates[0].content.parts.map(p => p.text).join("\n").trim();
      } else if (rawResp?.toString) {
        text = String(rawResp).trim();
      }
    } catch (e) {
      console.warn("Failed to extract text from rawResp:", e);
    }

    if (!text) {
      return res.status(502).json({ name: "unknown", description: "Empty model response", raw: JSON.stringify(rawResp).slice(0, 1000) });
    }

    // Try to extract JSON even if model included fences or extra text
    const parsed = extractJsonFromText(text);
    if (parsed) {
      return res.json({ ...parsed, model: MODEL_ID });
    }

    // Final fallback — return the raw text to frontend for debugging
    return res.json({
      name: "unknown",
      description: "Could not parse AI response",
      raw: text.slice(0, 2000),
      model: MODEL_ID
    });
  } catch (err) {
    console.error("Gemini error:", err && err.message ? err.message : err);
    if (String(err).toLowerCase().includes("model-timeout")) {
      return res.status(504).json({ error: "Model request timed out" });
    }
    return res.status(500).json({ error: "Identification failed" });
  }
});

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Gemini server running on port ${PORT}`));
