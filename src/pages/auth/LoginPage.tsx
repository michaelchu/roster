import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const returnUrl = searchParams?.get('returnUrl') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      const isSafeReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
      navigate(isSafeReturnUrl ? returnUrl : '/');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      // Store a safe return URL for use after OAuth redirect
      const isSafeReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
      const safeReturnUrl = isSafeReturnUrl ? returnUrl : '/';
      if (safeReturnUrl !== '/') {
        localStorage.setItem('returnUrl', safeReturnUrl);
      } else {
        localStorage.removeItem('returnUrl');
      }
      await signInWithGoogle();
      // Note: OAuth will redirect away, so no need to navigate here
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b">
        <div className="flex items-center justify-center px-4 py-2">
          <h1 className="text-lg font-semibold">Sign In</h1>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="bg-card rounded-lg p-3 border space-y-3">
          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border text-center">
          <h2 className="text-base font-medium mb-2">Welcome to Roster</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Sign in to create and manage your events
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-card rounded-lg p-3 border space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-10 text-sm"
              />
            </div>

            {error && (
              <div className="text-xs text-destructive-foreground bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="sm" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/auth/register" className="text-primary hover:underline">
                Sign Up
              </Link>
            </div>
          </div>
        </form>

        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-muted">
            <h3 className="text-sm font-medium">About This App</h3>
          </div>
          <div className="p-3">
            <div className="text-xs text-muted-foreground space-y-3">
              <div>
                <p className="mb-2">
                  Roster is a mobile-first event management platform designed to streamline event
                  registration and participant management. Create events, manage signups, and track
                  attendance all from your mobile device.
                </p>
              </div>

              <div>
                <div className="font-medium text-foreground mb-2">Install Mobile App</div>
                <div className="space-y-2">
                  <div>
                    <div className="font-medium">For iPhone/iPad:</div>
                    <div>1. Open this website in Safari</div>
                    <div>2. Tap the Share button (square with arrow)</div>
                    <div>3. Select "Add to Home Screen"</div>
                    <div>4. Tap "Add" to confirm</div>
                  </div>

                  <div>
                    <div className="font-medium">For Android:</div>
                    <div>1. Open this website in Chrome</div>
                    <div>2. Tap the menu (three dots)</div>
                    <div>3. Select "Add to Home screen"</div>
                    <div>4. Tap "Add" to confirm</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
