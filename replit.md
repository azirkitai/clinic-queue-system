# Clinic Calling System

## Overview
This project is a comprehensive clinic patient calling system designed to enhance efficiency in healthcare facilities. It provides real-time patient queue management, multi-user administration, and streamlined workflows for medical staff. Key capabilities include named patient registration with automatic queue numbering, dynamic window/room management, and administrative controls. The system aims to improve patient flow, reduce wait times, and optimize staff operations within a clinic setting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI/UX**: Shadcn/ui (Radix UI) and Tailwind CSS with Material Design principles, custom theme system with light/dark modes.
  - **Visual Theme**: Forced **Pure Dark Charcoal Gradient** mode (ThemeProvider locks to `dark` and overwrites localStorage on every load). Body, sidebar, and buttons all use the same neutral gradient: `linear-gradient(160deg, #000000 → #0a0a0a → #1a1a1a)` (sidebar 180deg vertical, body 160deg diagonal, button 135deg). No purple/teal/violet — pure black-to-charcoal. `--background: 215 35% 8%`, `--card: 210 35% 13%`, `--primary: 188 85% 50%` (cyan accents only on stat numbers/icons). The `.btn-gradient` utility now uses charcoal `#1a1a1a → #2a2a2a → #3a3a3a` for primary action buttons (Fullscreen TV, Login). Stat numbers retain semantic colors: amber (Waiting), sky (Called), violet (Dispensary), emerald (Completed), primary (Active Rooms).
  - **TV Display**: Optimized for Smart TVs with a light theme, white background, dark text, 2-3x larger fonts, and high contrast. Includes a manual toggle in settings for "TV Mode" which syncs across tabs via local storage.
- **State Management**: TanStack Query for server state, React hooks for local state.
- **Routing**: Wouter.
- **Real-time Updates**: WebSocket-driven with targeted `refetchQueries` for instant updates, 30-second polling as fallback.
- **Performance**: Isolated Clock component, CSS blink animations, debounced WebSocket refetching, lazy audio loading, and memoized prayer time highlighting for TV display optimization.

### Backend
- **Server**: Express.js with TypeScript.
- **Database**: Neon PostgreSQL with serverless driver, Drizzle ORM.
  - **Configuration**: Autoscaling (Min 0.25 CU, Max 1 CU), connection pooling (Max 10 connections, 30s idle timeout), database keepalives.
  - **Caching**: Server-side caching with tiered TTLs (2.5s for dynamic data, 30s for static data) and auto-invalidation on mutations.
  - **Cleanup**: Automated cleanup of completed patients older than 24 hours on startup.
  - **Dispensary**: Auto-Complete Dispensary Scheduler runs every 5 minutes with multi-tenant support and mutex guarding.
  - **End-of-Day Reset**: Per-tenant EOD scheduler (`server/eod-scheduler.ts`) ticks every 60s in Malaysia time. At 11:50pm broadcasts `system:eod-warning`, at 12:00am auto-closes every non-completed patient (`autoCloseAllPendingPatients`) tagged "Auto-closed end of day"; if any patient was registered/called in the last 10 min the reset is postponed by 30 min (broadcast `system:eod-postponed`, capped at 6 postpones). Admins can force a reset via `POST /api/system/eod-reset`. All notices are in English and rendered by `EodResetBanner` on the dashboard, fullscreen TV, and standalone TV pages.
- **API**: RESTful endpoints (`/api` prefix) with rate limiting (300 req/min general, 30 req/min for legacy endpoints) and traffic logging.
- **Storage**: Abstracted interface for memory/database implementations.
- **Session Management**: Express sessions with PostgreSQL store, including impersonation functionality for administrators.
- **Reliability**: DB retry logic for critical operations, robust error handling for unhandled rejections and uncaught exceptions.

### Database Schema
Key entities: Users (auth/roles), Windows (rooms/stations), Patients (queue management, status, priority), Settings (configurable parameters).

### Core Features
- **Patient Management**: Named patient registration with automatic queue numbering, priority patient management, real-time queue management, multi-window support.
- **TV Display Mode**: Full-screen display for calling, including Islamic prayer times, and a standalone TV Display page (`/tv/:token`) with short PIN access and WebSocket real-time updates.
- **Audio Integration**: Configurable preset sound alerts with Text-to-Speech (TTS) voice announcements in Bahasa Melayu (ms-MY) and English (en-US). Uses Microsoft Edge neural voices via `node-edge-tts` (free, natural-sounding: Yasmin/Osman for BM, Jenny/Guy for EN). Server-side synthesis with 1-hour audio caching.
- **Theme Customization**: Medical blue color scheme, accessibility-focused.
- **Security**: Role-based authentication (admin/user), secure session handling, BCrypt password hashing, admin impersonation.
- **System Health**: Stuck room self-healing to clear windows referencing deleted patients, user online/offline status tracking.
- **Bandwidth Optimization**: Lightweight TV endpoint (`/api/patients/tv`) for 85% payload reduction, media endpoint optimization for 99.9% payload reduction, reduced polling intervals, and Gzip compression.
- **Timezone Management**: All date-based operations use Malaysia timezone (UTC+8) for daily resets and history filtering.

## External Dependencies

### Core Technologies
- **@neondatabase/serverless**: PostgreSQL connectivity.
- **@tanstack/react-query**: Server state management and caching.
- **drizzle-orm**: Type-safe ORM for PostgreSQL.
- **bcryptjs**: Password hashing.

### UI & Design
- **@radix-ui/react-***: Accessible UI primitives.
- **tailwindcss**: CSS framework.
- **class-variance-authority**: Component variants.
- **lucide-react**: Icon library.

### Development Tools
- **vite**: Build tool and development server.
- **typescript**: Type safety.
- **wouter**: Routing library.
- **date-fns**: Date utilities.

### Session & Storage
- **connect-pg-simple**: PostgreSQL session store.
- **express-session**: Session middleware.

### Forms & Validation
- **react-hook-form**: Form state management.
- **@hookform/resolvers**: Form validation resolvers.
- **zod**: Schema validation.

### External APIs
- **aladhan.com**: For prayer times (server-side cached).
- **open-meteo.com**: For weather data (server-side cached).