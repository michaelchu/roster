import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenDrawer } from '@/components/ui/full-screen-drawer';
import { groupService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { Save, Trash2 } from 'lucide-react';
import type { Group } from '@/services/groupService';
import { groupFormSchema, type GroupFormData } from '@/lib/validation';
import { showFormErrors } from '@/lib/formUtils';

export function EditGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleClose = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/groups');
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
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

  useEffect(() => {
    if (!groupId) {
      setInitialLoading(false);
      return;
    }

    if (!user) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);

    // Create cancellation flag to prevent stale fetches from updating state
    let cancelled = false;

    const loadGroup = async () => {
      if (!groupId || !user) {
        if (!cancelled) setInitialLoading(false);
        return;
      }

      try {
        const data = await groupService.getGroupById(groupId);

        // Check if this fetch was cancelled before updating state
        if (cancelled) return;

        // Handle missing group
        if (!data) {
          if (!cancelled) {
            setGroup(null);
            setInitialLoading(false);
          }
          return;
        }

        // Verify ownership
        if (data.organizer_id !== user.id) {
          errorHandler.handle(new Error('Unauthorized'), {
            userId: user.id,
            action: 'loadGroupForEdit',
          });
          if (!cancelled) {
            setInitialLoading(false);
            navigate('/groups');
          }
          return;
        }

        if (!cancelled) {
          setGroup(data);
          reset({
            name: data.name,
            description: data.description || '',
          });
          setInitialLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          errorHandler.handle(error, {
            userId: user?.id,
            action: 'loadGroupForEdit',
          });
          setInitialLoading(false);
          navigate('/groups');
        }
      }
    };

    loadGroup();

    // Cleanup function to cancel the fetch if dependencies change
    return () => {
      cancelled = true;
    };
  }, [groupId, user, reset, navigate]);

  const onSubmit = async (data: GroupFormData) => {
    if (!group || !user) return;

    try {
      await groupService.updateGroup(group.id, {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      });

      errorHandler.success('Group updated successfully!');
      navigate(`/groups/${group.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'updateGroup',
        metadata: { groupId: group.id },
      });
    }
  };

  const confirmDelete = async () => {
    if (!group || !user) return;

    setDeleting(true);
    try {
      await groupService.deleteGroup(group.id, true);

      errorHandler.success('Group deleted successfully');

      // Close dialog before navigate to avoid setState on unmounted component
      setShowDeleteDialog(false);
      navigate('/groups');
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'deleteGroup',
        metadata: { groupId: group.id, groupName: group.name },
      });
    } finally {
      setDeleting(false);
    }
  };

  if (initialLoading) {
    return (
      <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
        <div className="flex-1 flex items-center justify-center p-4">
          <LoadingSpinner />
        </div>
      </FullScreenDrawer>
    );
  }

  if (!user) {
    return (
      <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
            <p className="text-sm text-muted-foreground mb-4">Please sign in to edit this group</p>
            <Button size="sm" onClick={() => navigate('/auth/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </FullScreenDrawer>
    );
  }

  if (!group) {
    return (
      <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold mb-2">Group Not Found</h1>
            <p className="text-sm text-muted-foreground">
              This group doesn't exist or you don't have permission to edit it.
            </p>
          </div>
        </div>
      </FullScreenDrawer>
    );
  }

  return (
    <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
      <form
        id="edit-group-form"
        onSubmit={handleSubmit(onSubmit, showFormErrors)}
        className="flex-1 flex flex-col overflow-y-auto p-3 bg-background"
      >
        {/* Group Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Group Name *</Label>
          <Input
            {...register('name')}
            id="name"
            type="text"
            placeholder="Enter group name"
            className={errors.name ? 'border-destructive' : ''}
            maxLength={200}
            autoComplete="off"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          <p className="text-xs text-muted-foreground">{nameValue?.length || 0}/200 characters</p>
        </div>

        {/* Description - fills remaining space */}
        <div className="flex-1 flex flex-col space-y-2 mt-4 min-h-0">
          <Label htmlFor="description">Description</Label>
          <Textarea
            {...register('description')}
            id="description"
            placeholder="Describe your group (optional)"
            className={`flex-1 resize-none min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
            maxLength={2000}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {descriptionValue?.length || 0}/2000 characters
          </p>
        </div>

        <div className="border-t mt-4" />

        {/* Delete Group Button */}
        <Button
          variant="outline"
          className="w-full mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isSubmitting || deleting}
          type="button"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Group
        </Button>

        {/* Save Changes Button */}
        <Button
          type="submit"
          disabled={isSubmitting || deleting}
          className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This will also delete all events and
              participant data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              {deleting ? 'Deleting...' : 'Delete Group'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FullScreenDrawer>
  );
}
