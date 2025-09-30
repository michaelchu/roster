import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
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
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { NewGroupPage } from '@/pages/NewGroupPage';
import { EditGroupPage } from '@/pages/EditGroupPage';
import { GroupParticipantsPage } from '@/pages/GroupParticipantsPage';
import { ManageRolesPage } from '@/pages/ManageRolesPage';
import { AddMembersPage } from '@/pages/AddMembersPage';
import { RemoveMembersPage } from '@/pages/RemoveMembersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();

  // Hide bottom nav on auth pages and signup pages (but only hide signup pages for non-authenticated users)
  const hideBottomNav =
    location.pathname.startsWith('/auth') || (location.pathname.startsWith('/signup') && !user);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/new" element={<NewEventPage />} />
        <Route path="/events/:eventId/edit" element={<EditEventPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/new" element={<NewGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/groups/:groupId/edit" element={<EditGroupPage />} />
        <Route path="/groups/:groupId/participants" element={<GroupParticipantsPage />} />
        <Route path="/groups/:groupId/manage-roles" element={<ManageRolesPage />} />
        <Route path="/groups/:groupId/add-members" element={<AddMembersPage />} />
        <Route path="/groups/:groupId/remove-members" element={<RemoveMembersPage />} />
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
            <Router>
              <AuthProvider>
                <AppContent />
                <Toaster />
              </AuthProvider>
            </Router>
          </MobileOnly>
        </FontSizeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
