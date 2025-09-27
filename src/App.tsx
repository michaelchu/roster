import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { FontSizeProvider } from '@/hooks/useFontSize';
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
import { SignupPage } from '@/pages/SignupPage';

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
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/signup/:eventId" element={<SignupPage />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-gray-500">Page not found</div>
                <button
                  onClick={() => window.history.back()}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
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
    </ErrorBoundary>
  );
}

export default App;
