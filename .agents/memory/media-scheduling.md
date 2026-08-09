---
name: Media scheduling
description: Rules for recurring TV/dashboard media schedules and their fallback behavior.
---

Recurring media schedules are interpreted in `Asia/Kuala_Lumpur` time. A matching active schedule overrides the normal dashboard media settings; when no schedule matches, the existing default media configuration remains in use.

**Why:** Clinic operators set schedules in local Malaysian time, while the server or TV browser may run in another timezone. Preserving the existing fallback also makes schedules opt-in and avoids blank displays.

**How to apply:** Keep schedule matching day-aware, support overnight slots, refresh TV media at least once per minute, and ensure `own` schedules do not inherit a stale YouTube URL while `combine` schedules may use YouTube audio.