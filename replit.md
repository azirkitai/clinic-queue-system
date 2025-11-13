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
- **Real-time Updates**: WebSocket-driven, with 30-second polling as a fallback for dashboards and 3-second polling for TV displays.

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
- **Audio Integration**: Configurable sound alerts and text-to-speech.
- **Theme Customization**: Medical blue color scheme, accessibility-focused.
- **Auto-Complete Dispensary**: Prevents queue congestion by automatically completing inactive patients.
- **Security**: Role-based authentication (admin/user), secure session handling, BCrypt password hashing.

### Performance Optimizations
- **Bandwidth Reduction**: Reduced TV display polling, tiered server-side caching, active patients endpoint for smaller payloads, response compression (Gzip), and dual-cache WebSocket sync.
- **CPU/Database Load Reduction**: Automatic data cleanup, server-side caching reducing DB queries by ~60%, WebSocket push minimizing polling, database connection pooling, and optimized SQL queries.
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