// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// --- Setup ---
dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Google Vision Setup ---
import vision from "@google-cloud/vision";

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// --- Routes ---
app.post("/identify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    // Send base64 image to Google Vision
    const [result] = await client.labelDetection({ image: { content: Buffer.from(image, "base64") } });
    const labels = result.labelAnnotations.map(label => label.description);
    
    res.json({ name: labels[0] || "Unknown", description: labels.join(", ") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Identification failed. Try later." });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
