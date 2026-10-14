---
name: Neon autosuspend
description: Cost and latency tradeoff for allowing the QueueTAWA database to suspend while idle.
---

Do not add a periodic database ping solely to keep Neon warm. Allow the database to suspend when no application queries are active.

**Why:** The user chose lower compute cost over always-warm responses and accepts a possible delay on the first query after an idle period.

**How to apply:** Rely on normal pool reconnection when the next request arrives. If changing database connection behavior, verify that the first request after idle succeeds; do not reintroduce a keepalive without discussing the cost/latency tradeoff.
