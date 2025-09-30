import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from '@/components/TopNav';
import { groupService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { Save, Trash2 } from 'lucide-react';
import type { Group } from '@/services/groupService';
import { ActionButton } from '@/components/ActionButton';

export function EditGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_private: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
          setFormData({
            name: data.name,
            description: data.description || '',
            is_private: data.is_private ?? false,
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
  }, [groupId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Group name must be 200 characters or less';
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !user) return;

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await groupService.updateGroup(group.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_private: formData.is_private,
      });

      errorHandler.success('Group updated successfully!');
      navigate(`/groups/${group.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'updateGroup',
        metadata: { groupId: group.id },
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!group || !user) return;

    setDeleting(true);
    try {
      await groupService.deleteGroup(group.id);

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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to edit this group</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Group Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This group doesn't exist or you don't have permission to edit it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="Edit Group" showBackButton backPath={`/groups/${group.id}`} />

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter group name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
              maxLength={200}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            <p className="text-xs text-muted-foreground">{formData.name.length}/200 characters</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your group (optional)"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
              maxLength={2000}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Privacy Setting */}
          <div className="space-y-3">
            <Label>Privacy</Label>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">Private Group</div>
                <div className="text-xs text-muted-foreground">
                  Only invited members can join this group
                </div>
              </div>
              <Switch
                checked={formData.is_private}
                onCheckedChange={(checked) => handleInputChange('is_private', checked)}
              />
            </div>
          </div>

          {/* Delete Group Button */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
            disabled={saving || deleting}
            type="button"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Group
          </Button>
        </form>
      </div>

      {/* Save Changes Button above navbar */}
      <ActionButton
        onClick={(e) => {
          e?.preventDefault();
          handleSubmit(e as unknown as React.FormEvent);
        }}
        loading={saving}
        disabled={deleting}
        loadingText="Saving..."
      >
        <Save className="h-4 w-4 mr-2" />
        Save Changes
      </ActionButton>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? All events and participants will be
              permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              {deleting ? 'Deleting...' : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
