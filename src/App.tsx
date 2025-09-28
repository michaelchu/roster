import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { FontSizeProvider } from '@/hooks/useFontSize';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileOnly } from '@/components/MobileOnly';
import { BottomNav } from '@/components/BottomNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';

import { HomePage } from '@/pages/HomePage';
import { EventsPage } from '@/pages/EventsPage';
import { NewEventPage } from '@/pages/NewEventPage';
import { EditEventPage } from '@/pages/EditEventPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { ParticipantsPage } from '@/pages/ParticipantsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

function AppContent() {
  const location = useLocation();

  // Hide bottom nav on auth pages and signup pages
  const hideBottomNav =
    location.pathname.startsWith('/auth') || location.pathname.startsWith('/signup');

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/new" element={<NewEventPage />} />
        <Route path="/events/:eventId/edit" element={<EditEventPage />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/signup/:eventId" element={<EventDetailPage />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Page not found</div>
                <button
                  onClick={() => window.history.back()}
                  className="mt-2 text-sm text-primary hover:text-primary/80"
                >
                  Go back
                </button>
              </div>
            </div>
          }
        />
      </Routes>

      {!hideBottomNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="roster-theme">
        <FontSizeProvider>
          <MobileOnly>
            <AuthProvider>
              <Router>
                <AppContent />
                <Toaster />
              </Router>
            </AuthProvider>
          </MobileOnly>
        </FontSizeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
