---
name: TV browser compatibility
description: Browser capability constraints and fallback strategy for the standalone clinic TV display.
---

The TV route must support a range of Smart TV browser generations, not just current Chrome. Compatibility has separate layers: JavaScript bundle parsing, HTML audio/autoplay, fullscreen, WebSocket, and responsive APIs.

**Why:** Some TVs can open module scripts but cannot parse newer JavaScript syntax, while others render correctly but lack Web Audio, WAV, fullscreen, or ResizeObserver. Treating all failures as one browser problem obscures the actual cause.

**How to apply:** Keep a Vite legacy bundle for old browsers, keep HTMLAudio as the audio fallback when Web Audio is unavailable, never block visual TV rendering because audio is unsupported, and expose capability diagnostics on the TV landing screen.

The standalone TV page stays eagerly available while authenticated management pages are lazy-loaded into separate chunks. The stylesheet pipeline preserves PostCSS source metadata before Vite rewrites asset URLs.

**Why:** Smart TVs need the smallest reliable startup path, while the previous monolithic entry bundle loaded dashboard/admin code they never use and triggered avoidable build warnings.