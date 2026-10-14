---
name: Edge TTS upstream endpoint
description: Free Edge Read Aloud endpoint migration and 403 behavior affecting node-edge-tts.
---

In October 2026, Microsoft Edge Read Aloud synthesis began returning HTTP 403 from `speech.platform.bing.com` in many regions. The synthesis endpoint moved to `api.msedgeservices.com/tts/cognitiveservices/websocket/v1`. The existing trusted client token is sent as `Ocp-Apim-Subscription-Key`, with the legacy `Sec-MS-GEC` and `Sec-MS-GEC-Version` query values.

**Why:** The app's existing `node-edge-tts` version still targets the legacy Bing host, so synthesis fails before audio reaches the browser.

**How to apply:** When Edge TTS returns a WebSocket handshake 403, first smoke-test the server endpoint and verify the host; do not misdiagnose it as TV mute/autoplay or switch to a billable provider without approval.
