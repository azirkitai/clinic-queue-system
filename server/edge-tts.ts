import express from "express";
import { EdgeTTS } from "node-edge-tts";
import { CHROMIUM_FULL_VERSION, generateSecMsGecToken, TRUSTED_CLIENT_TOKEN } from "node-edge-tts/dist/drm";
import { WebSocket } from "ws";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();
const TTS_OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";
const TTS_ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";

// Microsoft moved Edge Read Aloud synthesis to api.msedgeservices.com in
// October 2026. node-edge-tts 1.2.10 still connects to the old Bing host,
// which now rejects synthesis handshakes with HTTP 403.
class CompatibleEdgeTTS extends EdgeTTS {
  override async _connectWebSocket(): Promise<WebSocket> {
    const host = "api.msedgeservices.com";
    const params = new URLSearchParams({
      "Ocp-Apim-Subscription-Key": TRUSTED_CLIENT_TOKEN,
      "Sec-MS-GEC": generateSecMsGecToken(),
      "Sec-MS-GEC-Version": `1-${CHROMIUM_FULL_VERSION}`,
    });
    const socket = new WebSocket(
      `wss://${host}/tts/cognitiveservices/websocket/v1?${params.toString()}`,
      {
        host,
        origin: TTS_ORIGIN,
        headers: {
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
          "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split(".")[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split(".")[0]}.0.0.0`,
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );

    return new Promise((resolve, reject) => {
      socket.once("open", () => {
        socket.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n
          {
            "context": {
              "synthesis": {
                "audio": {
                  "metadataoptions": {
                    "sentenceBoundaryEnabled": "false",
                    "wordBoundaryEnabled": "true"
                  },
                  "outputFormat": "${TTS_OUTPUT_FORMAT}"
                }
              }
            }
          }
        `);
        resolve(socket);
      });
      socket.once("error", reject);
    });
  }
}

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
  ttsCache.forEach((val, key) => {
    if (now - val.timestamp > TTS_CACHE_TTL) {
      ttsCache.delete(key);
    }
  });
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

    const tts = new CompatibleEdgeTTS({
      voice: voiceConfig.voice,
      lang: voiceConfig.lang,
      outputFormat: TTS_OUTPUT_FORMAT,
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
