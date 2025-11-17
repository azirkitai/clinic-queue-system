# Clinic Calling System

## Overview
This project is a comprehensive clinic patient calling system designed to enhance efficiency in healthcare facilities. It provides real-time patient queue management, multi-user administration, and streamlined workflows for medical staff. Key capabilities include named patient registration with automatic queue numbering, dynamic window/room management, and administrative controls. The system aims to improve patient flow, reduce wait times, and optimize staff operations within a clinic setting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI/UX**: Shadcn/ui (Radix UI) and Tailwind CSS with Material Design principles. Custom theme system supporting light/dark modes.
- **State Management**: TanStack Query for server state, React hooks for local state.
- **Routing**: Wouter.
- **Real-time Updates**: WebSocket-driven with targeted `refetchQueries` for instant updates, with 30-second polling as fallback.
- **Custom Hooks**: `useTvPatients` hook consolidates TV display data from lightweight `/api/patients/tv` endpoint (currentPatient, queueWaiting, queueHistory).

### Backend
- **Server**: Express.js with TypeScript.
- **Database**: Neon PostgreSQL with serverless driver, Drizzle ORM.
  - **Autoscaling**: Min 0.25 CU, Max 1 CU.
  - **Connection Pooling**: Max 10 connections, 30s idle timeout.
  - **Server-Side Caching**: Tiered TTL (2.5s for dynamic data, 30s for static data) with auto-invalidation on mutations.
  - **Automated Cleanup**: Deletes completed patients older than 24 hours on startup.
  - **Auto-Complete Dispensary Scheduler**: Runs every 5 minutes to complete patients in dispensary >90 minutes, with multi-tenant support and mutex guarding.
- **API**: RESTful endpoints (`/api` prefix).
- **Storage**: Abstracted interface (memory/database implementations).
- **Session Management**: Express sessions with PostgreSQL store.

### Database Schema
Key entities: Users (auth/roles), Windows (rooms/stations), Patients (queue management, status, priority), Settings (configurable parameters).

### Core Features
- **Named Patient Registration**: Automatic queue numbering.
- **Priority Patient Management**: Visual indicators and dedicated display.
- **Real-time Queue Management**: Live status and position updates.
- **Multi-window Support**: Flexible room/station assignment.
- **TV Display Mode**: Full-screen display for calling, includes Islamic prayer times.
  - **TV Mode Toggle**: Manual toggle in Settings page for Smart TV browsers (localStorage-based).
  - **TV Optimizations**: Light theme with white background + dark text, 2-3x larger fonts using responsive clamp(), high contrast for TV visibility.
  - **Cross-tab Sync**: Custom events + storage events for instant updates across browser tabs.
  - **SSR-safe**: Browser guards prevent crashes in non-browser environments.
- **Audio Integration**: Configurable sound alerts and text-to-speech.
- **Theme Customization**: Medical blue color scheme, accessibility-focused.
- **Auto-Complete Dispensary**: Prevents queue congestion by automatically completing inactive patients.
- **Security**: Role-based authentication (admin/user), secure session handling, BCrypt password hashing.

### Performance Optimizations
- **Bandwidth Reduction**: 
  - **Lightweight TV endpoint** (`/api/patients/tv`) with TvQueueItem DTO achieving **85% payload reduction** (~70KB → ~10KB for 10 patients)
  - **Dashboard optimization**: Replaced heavy `/api/dashboard/current-call` + `/api/dashboard/history` endpoints (~71KB total) with single lightweight `/api/patients/tv` endpoint (~10KB)
  - **Media endpoint optimization** (`/api/display`): **99.9% payload reduction** by excluding base64 `data` field (~3MB → ~3KB)
    - Frontend loads media via `/api/media/:id/file` with 1-year HTTP cache headers
    - **Expected monthly savings**: ~1,290GB/month (43GB/day) with 10+ devices
  - **Total bandwidth reduction**: From ~76GB/month → ~12-15GB/month (80-84% reduction)
  - Reduced TV display polling from 3s to 30s
  - Tiered server-side caching (2.5s for patients, 30s for settings)
  - Active patients endpoint (`/api/patients/active`) excluding completed patients for smaller payloads
  - Response compression (Gzip)
  - Dual-cache WebSocket synchronization
- **CPU/Database Load Reduction**: 
  - Automatic data cleanup (completed patients >24 hours)
  - Server-side caching reducing DB queries by ~60%
  - **WebSocket optimizations**: 
    - Targeted `refetchQueries` on specific endpoints (patients, patients/tv, windows) for instant real-time updates
    - Reconnect only refetches essential queries (prevents bandwidth spike from heavy endpoints)
  - Database connection pooling (max 10 connections, 30s idle timeout)
  - Optimized SQL queries with LEFT JOIN for window names
  - Auto-Complete Dispensary Scheduler (every 5 minutes)
- **Scalability**: Documented support for Neon read replicas for further CPU optimization.

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
```