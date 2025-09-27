import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { User, LogOut } from 'lucide-react';
import { TopNav } from '@/components/TopNav';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-4">Please sign in to access settings</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <TopNav title="Settings" />

      <div className="p-3 space-y-3">
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium">{user.user_metadata?.full_name || 'User'}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
          </div>

          <div className="divide-y">
            <button
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
              onClick={() => navigate('/profile')}
            >
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm font-medium">Profile</div>
                <div className="text-xs text-gray-500">Update your information</div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-3">
          <Button variant="destructive" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="bg-white rounded-lg border p-3">
          <div className="text-xs text-gray-500">
            <div className="mb-2">
              <strong>About Roster</strong>
            </div>
            <div className="space-y-1">
              <div>Mobile-first event signup management</div>
              <div>Built with React, TypeScript, Tailwind CSS</div>
              <div>Database: Supabase (PostgreSQL)</div>
              <div>UI: shadcn/ui components</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
