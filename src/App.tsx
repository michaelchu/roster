import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { FeatureFlagsProvider, useFeatureFlag } from '@/hooks/useFeatureFlags';
import { FontSizeProvider } from '@/hooks/useFontSize';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileOnly } from '@/components/MobileOnly';
import { BottomNav } from '@/components/BottomNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';

import { HomePage } from '@/pages/HomePage';
import { EventsLayout } from '@/pages/EventsLayout';
import { NewEventPage } from '@/pages/NewEventPage';
import { EditEventPage } from '@/pages/EditEventPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { GroupsLayout } from '@/pages/GroupsLayout';
import { GroupDetailLayout } from '@/pages/GroupDetailLayout';
import { NewGroupPage } from '@/pages/NewGroupPage';
import { EditGroupPage } from '@/pages/EditGroupPage';
import { GroupParticipantsPage } from '@/pages/GroupParticipantsPage';
import { ManageRolesPage } from '@/pages/ManageRolesPage';
import { RemoveMembersPage } from '@/pages/RemoveMembersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { InviteConfirmationPage } from '@/pages/InviteConfirmationPage';

// Component that redirects / to /events if home_page flag is disabled
function HomePageOrRedirect() {
  const isHomePageEnabled = useFeatureFlag('home_page');
  const { user } = useAuth();

  // Only redirect logged-in users when home page is disabled
  if (!isHomePageEnabled && user) {
    return <Navigate to="/events" replace />;
  }

  return <HomePage />;
}

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();

  // Hide bottom nav on auth pages, signup pages, invite pages, and modal routes (but only hide signup pages for non-authenticated users)
  const hideBottomNav =
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/invite') ||
    (location.pathname.startsWith('/signup') && !user) ||
    location.pathname === '/events/new' ||
    /^\/events\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === '/groups/new' ||
    /^\/groups\/[^/]+\/edit$/.test(location.pathname) ||
    /^\/groups\/[^/]+\/events\/new$/.test(location.pathname);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePageOrRedirect />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/invite/:type/:id" element={<InviteConfirmationPage />} />
        <Route path="/signup/:eventId" element={<EventDetailPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <EventsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={null} />
          <Route path="new" element={<NewEventPage />} />
          <Route path=":eventId/edit" element={<EditEventPage />} />
        </Route>
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={null} />
          <Route path="new" element={<NewGroupPage />} />
        </Route>
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetailLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={null} />
          <Route path="edit" element={<EditGroupPage />} />
          <Route path="events/new" element={<NewEventPage />} />
        </Route>
        <Route
          path="/groups/:groupId/participants"
          element={
            <ProtectedRoute>
              <GroupParticipantsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId/manage-roles"
          element={
            <ProtectedRoute>
              <ManageRolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId/remove-members"
          element={
            <ProtectedRoute>
              <RemoveMembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
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
            <Router>
              <AuthProvider>
                <FeatureFlagsProvider>
                  <AppContent />
                  <Toaster />
                </FeatureFlagsProvider>
              </AuthProvider>
            </Router>
          </MobileOnly>
        </FontSizeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
