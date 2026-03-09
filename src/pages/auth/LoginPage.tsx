import { useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { initializeGoogleButton } from '@/lib/googleAuth';
import { TopNav } from '@/components/TopNav';
import { loginFormSchema, type LoginFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogleIdToken } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const returnUrl = searchParams?.get('returnUrl') || '/';

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signIn(data.email, data.password);
      const isSafeReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
      navigate(isSafeReturnUrl ? returnUrl : '/');
    } catch (err) {
      const error = err as Error;
      setError('root', { message: error.message || 'Failed to sign in' });
    }
  };

  useEffect(() => {
    // Initialize Google Sign-In button
    initializeGoogleButton(
      'google-signin-button',
      async (idToken: string) => {
        try {
          await signInWithGoogleIdToken(idToken);
          const isSafeReturnUrl =
            returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
          navigate(isSafeReturnUrl ? returnUrl : '/');
        } catch (err) {
          const error = err as Error;
          setError('root', { message: error.message || 'Failed to sign in with Google' });
        }
      },
      (err: Error) => {
        setError('root', { message: err.message || 'Failed to initialize Google Sign-In' });
      }
    );
  }, [returnUrl, navigate, signInWithGoogleIdToken, setError]);

  return (
    <div className="min-h-screen bg-background">
      <div
        onClick={() => navigate('/')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        <TopNav />
      </div>

      <div className="p-3 space-y-3">
        <form onSubmit={handleSubmit(onSubmit, showFormErrors)}>
          <div className="bg-card rounded-lg p-3 border space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                {...register('email')}
                id="email"
                type="email"
                placeholder="Enter your email"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <Input
                {...register('password')}
                id="password"
                type="password"
                placeholder="Enter your password"
                className="h-10 text-sm"
              />
            </div>

            <div className="text-right">
              <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>

            {errors.root && (
              <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
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
              <Link
                to={`/auth/register${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className="text-primary hover:underline"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
