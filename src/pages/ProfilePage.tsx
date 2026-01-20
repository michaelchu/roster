import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Save } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { UserAvatar } from '@/components/UserAvatar';
import { errorHandler } from '@/lib/errorHandler';
import { ProfilePageSkeleton } from '@/components/ProfilePageSkeleton';
import { profileFormSchema, type ProfileFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    try {
      const { error } = await supabase.auth.updateUser({
        email: data.email,
        data: {
          full_name: data.fullName,
        },
      });

      if (error) throw error;

      const emailChanged = data.email !== user.email;
      if (emailChanged) {
        errorHandler.success('A confirmation email has been sent to your new address');
      } else {
        errorHandler.success('Profile updated successfully!');
      }
      navigate('/settings');
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'updateProfile',
      });
    }
  };

  if (authLoading) {
    return <ProfilePageSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Please sign in to access your profile
          </p>
          <Button onClick={() => navigate('/auth/login')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopNav showCloseButton closePath="/settings" sticky />

      <form
        id="profile-form"
        onSubmit={handleSubmit(onSubmit, showFormErrors)}
        className="p-3 space-y-3"
      >
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-muted">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={user.user_metadata?.full_name}
                avatarUrl={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                size="lg"
                showIcon={!user.user_metadata?.full_name}
              />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Edit Profile</div>
                <div className="text-xs text-muted-foreground">
                  Update your personal information
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">
                Full Name
              </Label>
              <Input
                {...register('fullName')}
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email Address
              </Label>
              <Input
                {...register('email')}
                id="email"
                type="email"
                placeholder="Enter your email address"
                className="h-10 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Changing your email will require verification
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">
            <div className="mb-2">
              <strong>Account Information</strong>
            </div>
            <div className="space-y-1">
              <div>User ID: {user.id.slice(0, 8)}...</div>
              <div>Account created: {new Date(user.created_at!).toLocaleDateString()}</div>
              <div>
                Last sign in:{' '}
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Save Changes Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {isSubmitting ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
