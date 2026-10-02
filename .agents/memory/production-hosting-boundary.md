---
name: Production hosting boundary
description: Distinguishes the live Render service from the Replit workspace deployment and its logs.
---

The live QueueTAWA custom domain is served by Render. Replit may also report a separate workspace deployment, but its deployment status and logs do not represent Render production traffic.

**Why:** During bandwidth investigation, Replit deployment logs were empty while the live custom domain returned Render-origin headers.

**How to apply:** For production traffic, bandwidth, or runtime diagnosis, use Render metrics/logs or add safe request-size instrumentation to the app and deploy it to Render; do not treat Replit logs as production evidence.