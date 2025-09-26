# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build & Development:**
- `npm run dev` - Start Vite development server
- `npm run build` - TypeScript compilation + Vite production build
- `npm run preview` - Preview production build
- `npm start` - Production preview with host binding

**Code Quality:**
- `npm run lint` - ESLint with modern flat config
- `npm run format` - Prettier formatting for all source files
- `npm run format:check` - Check formatting without modification

**Testing:**
- `npm run test` - Run Vitest test suite
- `npm run test:ui` - Interactive Vitest UI
- `npm run test:coverage` - Generate test coverage reports

## High-Level Architecture

### Project Structure
This is a **mobile-first React event management platform** with a service layer architecture:

```
src/
├── components/          # UI components with shadcn/ui integration
├── hooks/              # Custom React hooks (useAuth for authentication)
├── pages/              # Route-based page components
├── services/           # Business logic & database abstraction layer
├── types/              # TypeScript type definitions
└── test/               # Testing utilities, mocks, fixtures
```

### Key Architectural Patterns

**Service Layer Pattern:** All business logic lives in `/src/services/` with typed interfaces. Services handle Supabase database interactions and provide clean APIs to React components.

**Mobile-Only Enforcement:** The app uses a `MobileOnly` component to restrict access to mobile devices only, reflecting its WeChat-inspired dense UI design.

**Authentication Flow:** Supabase Auth with automatic organizer profile creation via database triggers. Authentication state managed through custom `useAuth` hook.

### Technology Stack
- **Frontend:** React 19 + TypeScript (strict mode) + Vite
- **UI:** Tailwind CSS + shadcn/ui (New York style) + Radix UI primitives
- **Backend:** Supabase (PostgreSQL with Row Level Security)
- **Testing:** Vitest + Testing Library + MSW for API mocking
- **Routing:** React Router DOM v7

### Database Schema
Core tables: `organizers`, `events`, `participants`, `labels`, `participant_labels`
- **JSONB fields** for flexible custom form fields in events
- **Row Level Security (RLS)** enabled on all tables with comprehensive policies
- **Public signup access** for participants, protected organizer data

### Service Layer
Services are typed and handle all database interactions:
- `eventService.ts` - Event CRUD with participant counting
- `participantService.ts` - Registration management and CSV export
- `labelService.ts` - Participant categorization
- `organizerService.ts` - User profile management

All services export from `/src/services/index.ts` for clean imports.

### Testing Approach
- **Service layer unit tests** with mocked Supabase client
- **Component integration tests** using Testing Library
- **Test fixtures** in `/src/test/fixtures/` for reusable test data
- **MSW mocking** for API endpoints during testing

### Code Quality Standards
- **TypeScript strict mode** enforced with comprehensive type checking
- **ESLint flat config** with React-specific rules
- **Prettier formatting** (single quotes, 100 char width)
- **Path aliases:** `@/*` maps to `./src/*`

### Mobile-First Design Philosophy
- WeChat-inspired compact UI with minimal whitespace
- Bottom navigation for thumb-friendly mobile access
- Dense information display optimized for mobile screens
- Device detection enforces mobile-only usage