---
name: TV display layout
description: Durable layout rule for the queue TV display and its responsive calling panels.
---

TV display sections should preserve their internal visual structure across screen ratios. Use bounded boxes with fixed proportions or controlled heights, and fit long text inside those boxes rather than allowing text content to resize grid rows or push neighboring elements.

**Why:** The display is used on TVs with different aspect ratios, and changing row geometry makes the calling panel and clinic information misalign or overflow.

**How to apply:** Keep calling overlays, clinic names, patient names, room labels, and footer information inside `min-width: 0`/`min-height: 0` containers with overflow protection and measured text fitting.