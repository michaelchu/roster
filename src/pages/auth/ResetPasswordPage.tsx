import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from '@/components/TopNav';
import { resetPasswordFormSchema, type ResetPasswordFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await updatePassword(data.password);
      navigate('/auth/login');
    } catch (err) {
      const error = err as Error;
      setError('root', { message: error.message || 'Failed to reset password' });
    }
  };

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
            <div className="text-sm text-muted-foreground">Enter your new password.</div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                New Password
              </Label>
              <Input
                {...register('password')}
                id="password"
                type="password"
                placeholder="Enter new password"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">
                Confirm Password
              </Label>
              <Input
                {...register('confirmPassword')}
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                className="h-10 text-sm"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
