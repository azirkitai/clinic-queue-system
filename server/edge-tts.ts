import express from "express";
import { EdgeTTS } from "node-edge-tts";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const VOICE_MAP: Record<string, { voice: string; lang: string }> = {
  "ms-MY-FEMALE": { voice: "ms-MY-YasminNeural", lang: "ms-MY" },
  "ms-MY-MALE": { voice: "ms-MY-OsmanNeural", lang: "ms-MY" },
  "en-US-FEMALE": { voice: "en-US-JennyNeural", lang: "en-US" },
  "en-US-MALE": { voice: "en-US-GuyNeural", lang: "en-US" },
};

const ttsCache = new Map<string, { audio: string; timestamp: number }>();
const TTS_CACHE_TTL = 3600000;
const TTS_CACHE_MAX = 200;

function cleanTtsCache() {
  const now = Date.now();
  for (const [key, val] of ttsCache) {
    if (now - val.timestamp > TTS_CACHE_TTL) {
      ttsCache.delete(key);
    }
  }
  if (ttsCache.size > TTS_CACHE_MAX) {
    const entries = Array.from(ttsCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, entries.length - TTS_CACHE_MAX);
    for (const [key] of toDelete) {
      ttsCache.delete(key);
    }
  }
}

const tmpDir = path.join("/tmp", "tts-audio");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

router.post("/synthesize", async (req, res) => {
  try {
    const { text, language, gender = "FEMALE" } = req.body as {
      text: string;
      language: "ms-MY" | "en-US";
      gender?: "MALE" | "FEMALE";
    };

    if (!text || !language) {
      return res.status(400).json({ error: "text and language are required" });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: "Text too long (max 500 chars)" });
    }

    const cacheKey = `${language}:${gender}:${text}`;
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TTS_CACHE_TTL) {
      return res.json({ audioContent: cached.audio });
    }

    const voiceKey = `${language}-${gender}`;
    const voiceConfig = VOICE_MAP[voiceKey] || VOICE_MAP[`${language}-FEMALE`];

    if (!voiceConfig) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const fileId = crypto.randomBytes(8).toString("hex");
    const audioPath = path.join(tmpDir, `${fileId}.mp3`);

    const tts = new EdgeTTS({
      voice: voiceConfig.voice,
      lang: voiceConfig.lang,
      outputFormat: "audio-48khz-192kbitrate-mono-mp3",
      rate: "+0%",
      pitch: "+0Hz",
      timeout: 15000,
    });

    await tts.ttsPromise(text, audioPath);

    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString("base64");

    try {
      fs.unlinkSync(audioPath);
    } catch {}

    ttsCache.set(cacheKey, { audio: base64Audio, timestamp: Date.now() });
    cleanTtsCache();

    res.json({ audioContent: base64Audio });
  } catch (error) {
    console.error("[TTS] Synthesis error:", error);
    res.status(500).json({ error: "TTS synthesis failed" });
  }
});

router.post("/clear-cache", async (_req, res) => {
  ttsCache.clear();
  res.json({ success: true, message: "TTS cache cleared" });
});

console.log("[TTS] Edge TTS initialized (free neural voices - Yasmin/Osman for BM, Jenny/Guy for EN)");

export default router;
