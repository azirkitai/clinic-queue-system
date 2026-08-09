---
name: WebSocket reconnect reliability
description: Durable constraints for clinic queue real-time connections across dashboard and TV displays.
---

The dashboard and TV display must not create competing Socket.IO clients for the same authenticated page. One shared client should own clinic-room events; standalone TV pages may use their dedicated token socket.

**Why:** Duplicate clients were created when the dashboard rendered the TV component, and component cleanup/HMR produced misleading `io client disconnect` events. A missed event during a real transport interruption can also leave the displayed call stale.

**How to apply:** Keep automatic reconnect infinite with a short bounded delay, listen for reconnect lifecycle events on the Socket.IO manager, force a guarded reconnect from browser online/visibility/watchdog signals, and refetch persisted patient/window state after every successful connection. Keep a short HTTP polling fallback for TV state.