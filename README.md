# Venu - Mobile Event Signup Platform

A mobile-first event management platform built with React, TypeScript, and Supabase.

## Features

### For Participants
- **Mobile-Only Access** - Platform enforces mobile device usage
- **Quick Signup** - Simple form-based registration for events
- **Quick Fill** - Auto-fills participant information from localStorage
- **Custom Fields** - Support for event-specific custom fields
- **Confirmation Screen** - Shows registration success

### For Organizers
- **Event Management** - Create, view, and manage events
- **Participant Management** - View all registered participants
- **Label System** - Organize participants with custom labels
- **Event Duplication** - Copy events with all settings and labels
- **CSV Export** - Download participant lists with labels
- **Real-time Updates** - Live participant counts and registration

### Design
- **WeChat-Style UI** - Compact, dense layouts with minimal whitespace
- **List-Based Interface** - No floating cards, everything in lists
- **Mobile Navigation** - Persistent bottom navigation bar
- **Responsive** - Optimized for mobile screens only

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: localStorage for Quick Fill

## Database Schema

The app uses the following tables:
- `organizers` - User profiles linked to Supabase Auth
- `events` - Event information with custom fields
- `participants` - Event registrations
- `labels` - Event-specific participant labels
- `participant_labels` - Many-to-many relationship for labels

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Run Database Migration**
   Execute the SQL in `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Usage

### Creating an Event
1. Sign up/login as an organizer
2. Navigate to Events tab
3. Click "New" to create an event
4. Add event details and custom fields
5. Share the signup link with participants

### Managing Participants
1. View participants in the event detail page
2. Add/remove labels for organization
3. Export participant data to CSV
4. Search and filter participants

### Participant Registration
1. Participants access the signup link on mobile
2. Fill out the registration form
3. Information is saved for Quick Fill on future events
4. Confirmation screen shows successful registration

## Key Files

- `src/App.tsx` - Main app with routing
- `src/hooks/useAuth.tsx` - Authentication context
- `src/lib/supabase.ts` - Database client and types
- `src/components/BottomNav.tsx` - Mobile navigation
- `src/components/MobileOnly.tsx` - Desktop restriction
- `supabase/migrations/001_initial_schema.sql` - Database schema

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT License