import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from '@/components/TopNav';
import { forgotPasswordFormSchema, type ForgotPasswordFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { resetPasswordForEmail } = useAuth();
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await resetPasswordForEmail(data.email);
      setEmailSent(true);
    } catch (err) {
      const error = err as Error;
      setError('root', { message: error.message || 'Failed to send reset email' });
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background">
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <TopNav />
        </div>

        <div className="p-3 space-y-3">
          <div className="bg-card rounded-lg p-3 border space-y-3">
            <div className="text-sm text-center space-y-2">
              <p>Check your email for a password reset link.</p>
              <p className="text-muted-foreground text-xs">
                If you don't see it, check your spam folder.
              </p>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <Link to="/auth/login" className="text-primary hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="text-sm text-muted-foreground">
              Enter your email and we'll send you a link to reset your password.
            </div>

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

            {errors.root && (
              <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              <Link to="/auth/login" className="text-primary hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
