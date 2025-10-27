# Clinic Calling System

## Overview

This is a comprehensive clinic patient calling system designed for healthcare facilities. The application enables efficient patient queue management with real-time TV displays, multi-user administration, and streamlined workflows for medical staff. Built with React, TypeScript, and modern web technologies, it supports named patient registration with automatic queue numbering, window/room management, and administrative controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system following Material Design principles
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Theme System**: Custom theme provider supporting light/dark modes with CSS variables

### Backend Architecture
- **Server**: Express.js with TypeScript
- **Database**: Neon PostgreSQL with serverless driver
  - **Autoscale Settings**: Min 0.25 CU, Max 1 CU (no scale-to-zero)
  - **Connection**: Uses `@neondatabase/serverless` with pooling
  - **Optimization**: Server-side caching (2-3s TTL) for high-frequency endpoints
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **API Design**: RESTful endpoints with `/api` prefix
- **Storage Layer**: Abstracted storage interface with both memory and database implementations
- **Session Management**: Express session handling with PostgreSQL session store

### Database Schema
The system uses four main entities:
- **Users**: Authentication and role-based access (admin/user roles)
- **Windows**: Treatment rooms/stations with active status tracking
- **Patients**: Queue management with status tracking (waiting, called, in-progress, completed, requeue) and priority flagging
- **Settings**: Configurable system parameters for display, sound, and general settings

### Component Architecture
- **Layout**: Sidebar-based navigation with responsive design
- **Patient Management**: Card-based interfaces for registration, queue viewing, and calling
- **TV Display**: Full-screen component optimized for large displays with real-time updates
- **Administration**: Role-based user management and system configuration

### Key Features
- **Named Patient Registration**: All patients register with their full name and receive an automatic queue number
- **Priority Patient Management**: Toggle priority status for urgent cases with dedicated section display and visual indicators
- **Real-time Queue Management**: Live updates for patient status and queue position
- **Multi-window Support**: Flexible room/station configuration with individual patient assignments
- **TV Display Mode**: Large-format display for patient calling with Islamic prayer times integration
- **Audio Integration**: Configurable sound alerts and text-to-speech capabilities
- **Theme Customization**: Medical blue color scheme with accessibility considerations

### Security & Access Control
- **Role-based Authentication**: Admin and user roles with different permission levels
- **Session Management**: Secure session handling with database persistence
- **Password Hashing**: BCrypt for secure password storage

## External Dependencies

### Core Technologies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe SQL query builder and ORM
- **bcryptjs**: Password hashing and authentication

### UI & Design
- **@radix-ui/react-***: Accessible UI primitives for components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Modern icon library

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Type safety and developer experience
- **wouter**: Lightweight routing library
- **date-fns**: Date manipulation utilities

### Session & Storage
- **connect-pg-simple**: PostgreSQL session store for Express
- **express-session**: Session middleware for user authentication

### Forms & Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation (via Drizzle)

The application is designed to be deployed on platforms supporting Node.js with PostgreSQL database connectivity, with specific optimizations for Replit deployment including development tooling and error overlays.