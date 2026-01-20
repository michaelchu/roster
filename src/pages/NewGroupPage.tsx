import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from '@/components/TopNav';
import { groupService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { Plus } from 'lucide-react';
import { groupFormSchema, type GroupFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function NewGroupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const nameValue = watch('name');
  const descriptionValue = watch('description');

  const onSubmit = async (data: GroupFormData) => {
    if (!user) {
      errorHandler.handle(new Error('You must be signed in to create a group'));
      return;
    }

    try {
      const group = await groupService.createGroup({
        organizer_id: user.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      });

      errorHandler.success('Group created successfully!');
      navigate(`/groups/${group.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      errorHandler.handle(error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to create a group</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopNav showCloseButton sticky />

      <form
        id="create-group-form"
        onSubmit={handleSubmit(onSubmit, showFormErrors)}
        className="p-3 space-y-4"
      >
        {/* Group Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm">
            Group Name *
          </Label>
          <Input
            {...register('name')}
            id="name"
            type="text"
            placeholder="Enter group name"
            className={`h-10 text-sm ${errors.name ? 'border-destructive' : ''}`}
            maxLength={200}
            autoComplete="off"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          <p className="text-xs text-muted-foreground">{nameValue?.length || 0}/200 characters</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm">
            Description
          </Label>
          <Textarea
            {...register('description')}
            id="description"
            placeholder="Describe your group (optional)"
            className={`text-sm resize-none ${errors.description ? 'border-destructive' : ''}`}
            rows={3}
            maxLength={2000}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {descriptionValue?.length || 0}/2000 characters
          </p>
        </div>

        {/* Create Group Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {isSubmitting ? (
            'Creating Group...'
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
