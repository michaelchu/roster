import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, User, ArrowLeft } from 'lucide-react';
import { eventService, participantService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { SignupPageSkeleton } from '@/components/SignupPageSkeleton';

interface CustomField {
  id?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required?: boolean;
  options?: string[];
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  custom_fields: CustomField[];
  max_participants?: number | null;
  participant_count?: number;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  responses: Record<string, string>;
}

/**
 * Renders the event signup page and manages the full registration flow.
 *
 * Auto-fills name and email for logged-in users and uses localStorage to persist quick-fill data for anonymous users.
 * Validates required fields (including event custom fields), submits participant data to the participant service,
 * and displays loading, not-found, error, and success states.
 *
 * @returns The signup page UI for an event, including event details, the registration form, and conditional loading/not-found/success views.
 */
export function SignupPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    responses: {},
  });

  // Auto-fill form if user is logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.user_metadata?.full_name || user.email || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  // Load quick-fill data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('venu-signup-form');
    if (saved && !user) {
      try {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Ignore invalid saved data
      }
    }
  }, [user]);

  const saveQuickFill = () => {
    if (!user) {
      localStorage.setItem(
        'venu-signup-form',
        JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        })
      );
    }
  };

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;

      try {
        const data = await eventService.getEventById(eventId);
        setEvent({
          id: data.id,
          name: data.name,
          description: data.description || '',
          datetime: data.datetime || '',
          location: data.location || '',
          custom_fields: data.custom_fields || [],
          max_participants: data.max_participants,
          participant_count: data.participant_count,
        });
      } catch (err) {
        errorHandler.handle(err, {
          action: 'loadEventForSignup',
        });
        setError('Event not found');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event) return;

    // Basic validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate required custom fields
    for (const field of event.custom_fields) {
      if (field.required && !formData.responses[field.id || field.label]?.trim()) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      saveQuickFill();

      await participantService.createParticipant({
        event_id: event.id,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        responses: formData.responses,
        user_id: user?.id || null,
        notes: null,
        claimed_by_user_id: null,
      });

      errorHandler.success(`Successfully signed up for "${event.name}"!`);
      setSubmitted(true);
    } catch (err) {
      errorHandler.handle(err, {
        action: 'signupForEvent',
        metadata: { eventId: event.id, eventName: event.name },
      });
      const error = err as Error;
      setError(error.message || 'Failed to sign up');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SignupPageSkeleton />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-4">Event not found</div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <CheckCircle className="w-16 h-16 mx-auto text-primary mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Registration Successful!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You've successfully registered for "{event.name}". You should receive a confirmation
            soon.
          </p>
          <div className="space-y-3">
            <Button onClick={() => navigate('/')} className="w-full">
              Continue
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
              Register Another Person
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-primary hover:text-primary/80"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-lg font-semibold text-center flex-1 mr-16">{event.name}</h1>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Event Info Card - Same layout as EventDetailPage */}
        {(event.description || event.datetime || event.location) && (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 space-y-2">
              {/* Top row: Date and Registration info */}
              {event.datetime && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Date</div>
                    <div>
                      {new Date(event.datetime).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Participants</div>
                    <div>
                      {event.participant_count || 0}
                      {event.max_participants ? ` / ${event.max_participants}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              {event.location && (
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Location</div>
                  <div>{event.location}</div>
                </div>
              )}

              {/* Divider */}
              {event.location && event.description && (
                <div className="border-t border-border"></div>
              )}

              {/* Description */}
              {event.description && (
                <div className="text-sm text-foreground">
                  <div className="font-medium text-foreground mb-1">Description</div>
                  <p className="leading-relaxed">{event.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-card rounded-lg border">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold">Register for this event</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Your full name"
                  required
                  className="mt-1"
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="mt-1"
                />
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Your phone number"
                  className="mt-1"
                />
              </div>

              {/* Custom Fields */}
              {event.custom_fields.map((field) => (
                <div key={field.id || field.label}>
                  <Label htmlFor={field.id} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'select' && field.options ? (
                    <select
                      id={field.id}
                      value={formData.responses[field.id || field.label] || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          responses: {
                            ...prev.responses,
                            [field.id || field.label]: e.target.value,
                          },
                        }))
                      }
                      required={field.required}
                      className="mt-1 block w-full rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select an option</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={field.id}
                      type={field.type}
                      value={formData.responses[field.id || field.label] || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          responses: {
                            ...prev.responses,
                            [field.id || field.label]: e.target.value,
                          },
                        }))
                      }
                      required={field.required}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}

              {/* Error Message */}
              {error && (
                <div className="text-sm text-destructive-foreground bg-destructive/10 p-2 rounded">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Registering...' : 'Register'}
              </Button>
            </form>

            {!user && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Your information will be saved to make future registrations easier.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
