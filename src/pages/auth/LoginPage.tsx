import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { initializeGoogleButton } from '@/lib/googleAuth';
import { TopNav } from '@/components/TopNav';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogleIdToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    // Initialize Google Sign-In button
    initializeGoogleButton(
      'google-signin-button',
      async (idToken: string) => {
        setError('');
        try {
          await signInWithGoogleIdToken(idToken);
          const isSafeReturnUrl =
            returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
          navigate(isSafeReturnUrl ? returnUrl : '/');
        } catch (err) {
          const error = err as Error;
          setError(error.message || 'Failed to sign in with Google');
        }
      },
      (err: Error) => {
        setError(err.message || 'Failed to initialize Google Sign-In');
      }
    );
  }, [returnUrl, navigate, signInWithGoogleIdToken]);

  return (
    <div className="min-h-screen bg-background">
      <div
        onClick={() => navigate('/')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        <TopNav />
      </div>

      <div className="p-3 space-y-3">
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
              <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
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

            {/* Google Sign In Button */}
            <div id="google-signin-button" className="flex justify-center" />

            <div className="text-center text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/auth/register" className="text-primary hover:underline">
                Sign Up
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
