# Clinic Calling System

## Overview
This project is a comprehensive clinic patient calling system designed to enhance efficiency in healthcare facilities. It provides real-time patient queue management, multi-user administration, and streamlined workflows for medical staff. Key capabilities include named patient registration with automatic queue numbering, dynamic window/room management, and administrative controls. The system aims to improve patient flow, reduce wait times, and optimize staff operations within a clinic setting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI/UX**: Shadcn/ui (Radix UI) and Tailwind CSS with Material Design principles, custom theme system with light/dark modes.
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
- **API**: RESTful endpoints (`/api` prefix) with rate limiting (300 req/min general, 30 req/min for legacy endpoints) and traffic logging.
- **Storage**: Abstracted interface for memory/database implementations.
- **Session Management**: Express sessions with PostgreSQL store, including impersonation functionality for administrators.
- **Reliability**: DB retry logic for critical operations, robust error handling for unhandled rejections and uncaught exceptions.

### Database Schema
Key entities: Users (auth/roles), Windows (rooms/stations), Patients (queue management, status, priority), Settings (configurable parameters).

### Core Features
- **Patient Management**: Named patient registration with automatic queue numbering, priority patient management, real-time queue management, multi-window support.
- **TV Display Mode**: Full-screen display for calling, including Islamic prayer times, and a standalone TV Display page (`/tv/:token`) with short PIN access and WebSocket real-time updates.
- **Audio Integration**: Configurable preset sound alerts with Text-to-Speech (TTS) voice announcements in Bahasa Melayu (ms-MY), English (en-US), or both languages. Uses browser built-in Web Speech API (zero cost). Configurable speech rate.
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