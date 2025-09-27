import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

export function NewEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datetime: '',
    location: '',
    max_participants: null as number | null,
    is_private: false,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);

  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false,
    };
    setCustomFields([...customFields, newField]);
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(
      customFields.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((field) => field.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const eventData = await eventService.createEvent({
        organizer_id: user.id,
        name: formData.name,
        description: formData.description || null,
        datetime: formData.datetime || null,
        location: formData.location || null,
        max_participants: maxParticipants,
        is_private: formData.is_private,
        custom_fields: customFields.filter((f) => f.label),
        parent_event_id: null,
      });

      errorHandler.success(`Event "${eventData.name}" created successfully!`);
      navigate(`/events/${eventData.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'createEvent',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <TopNav title="Create Event" showBackButton backPath="/events" sticky />

      <form id="create-event-form" onSubmit={handleSubmit} className="p-3 space-y-3">
        <div className="bg-white rounded-lg p-3 border space-y-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Event Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm">
              Description
            </Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm border rounded-md resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="datetime" className="text-sm">
              Date & Time
            </Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={formData.datetime}
              onChange={(e) => setFormData((prev) => ({ ...prev, datetime: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm">
              Location
            </Label>
            <Input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          <MaxParticipantsInput value={maxParticipants} onChange={setMaxParticipants} />

          <div className="space-y-2">
            <Label className="text-sm">Event Privacy</Label>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  is_private: !prev.is_private,
                }))
              }
              className={`flex items-center justify-between w-full p-3 rounded-lg border-2 transition-colors ${
                formData.is_private ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                {formData.is_private ? (
                  <Lock className="h-4 w-4 text-red-600" />
                ) : (
                  <Unlock className="h-4 w-4 text-green-600" />
                )}
                <span
                  className={`font-medium ${
                    formData.is_private ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {formData.is_private ? 'Private Event' : 'Public Event'}
                </span>
              </div>
            </button>
            <p className="text-xs text-gray-500">
              {formData.is_private
                ? 'Only people you invite can view and sign up for this event'
                : 'Anyone with the link can view and sign up for this event'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Custom Fields</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={addCustomField}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
          </div>

          {customFields.length === 0 ? (
            <p className="text-xs text-gray-500">
              No custom fields. Add fields to collect additional information from participants.
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="p-3 bg-gray-50 rounded space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateCustomField(field.id, {
                          type: e.target.value as CustomField['type'],
                          options: e.target.value === 'select' ? [''] : undefined,
                        })
                      }
                      className="flex-1 h-9 px-2 text-sm border rounded"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateCustomField(field.id, {
                            required: e.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options (one per line)</Label>
                      <textarea
                        value={field.options?.join('\n') || ''}
                        onChange={(e) =>
                          updateCustomField(field.id, {
                            options: e.target.value.split('\n').filter(Boolean),
                          })
                        }
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        className="w-full px-2 py-1 text-sm border rounded resize-none"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* Create Event Button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2">
        <Button
          type="submit"
          form="create-event-form"
          className="w-full text-white shadow-lg"
          size="sm"
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Creating...</span>
            </>
          ) : (
            'Create Event'
          )}
        </Button>
      </div>
    </div>
  );
}
