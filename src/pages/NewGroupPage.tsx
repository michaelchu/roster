import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from '@/components/TopNav';
import { groupService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';

export function NewGroupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      errorHandler.handle(new Error('You must be signed in to create a group'));
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const group = await groupService.createGroup({
        organizer_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      errorHandler.success('Group created successfully!');
      navigate(`/groups/${group.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      errorHandler.handle(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
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

      <form id="create-group-form" onSubmit={handleSubmit} className="p-3 space-y-4">
        {/* Group Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm">
            Group Name *
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Enter group name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`h-10 text-sm ${errors.name ? 'border-destructive' : ''}`}
            maxLength={200}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          <p className="text-xs text-muted-foreground">{formData.name.length}/200 characters</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your group (optional)"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className={`text-sm resize-none ${errors.description ? 'border-destructive' : ''}`}
            rows={3}
            maxLength={2000}
          />
          {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          <p className="text-xs text-muted-foreground">
            {formData.description.length}/2000 characters
          </p>
        </div>

        {/* Create Group Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {loading ? 'Creating Group...' : 'Create Group'}
        </Button>
      </form>
    </div>
  );
}
