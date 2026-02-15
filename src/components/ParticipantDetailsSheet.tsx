import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import type { Participant as ServiceParticipant, Label as LabelType } from '@/services';
import type { CustomField } from '@/types/app.types';

type Participant = ServiceParticipant & {
  notes?: string | null;
  user_id?: string | null;
};

interface ParticipantDetailsSheetProps {
  participant: Participant | null;
  labels: LabelType[];
  customFields: CustomField[];
  isOrganizer: boolean;
  isPaid: boolean;
  onClose: () => void;
  onTogglePayment: (participant: Participant) => void;
  onToggleLabel: (participant: Participant, label: LabelType) => void;
}

/**
 * Sheet component for displaying and editing participant details.
 * Shows contact info, payment status, custom field responses, and labels.
 */
export function ParticipantDetailsSheet({
  participant,
  labels,
  customFields,
  isOrganizer,
  isPaid,
  onClose,
  onTogglePayment,
  onToggleLabel,
}: ParticipantDetailsSheetProps) {
  if (!participant) return null;

  return (
    <Sheet open={!!participant} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>{participant.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-2">
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">Contact Information</h3>
            <div className="text-sm space-y-0.5">
              <div>Email: {participant.email || 'Not provided'}</div>
              <div>Phone: {participant.phone || 'Not provided'}</div>
              <div>Registered: {new Date(participant.created_at).toLocaleString()}</div>
            </div>
          </div>

          {isOrganizer && isPaid && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Payment Status</h3>
              <div className="flex items-center gap-2">
                <PaymentStatusBadge status={participant.payment_status} size="md" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTogglePayment(participant)}
                  className="text-xs h-7 px-3"
                >
                  {participant.payment_status === 'paid' ? 'Mark as Pending' : 'Mark as Paid'}
                </Button>
              </div>
              {participant.payment_marked_at && (
                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(participant.payment_marked_at).toLocaleString()}
                </div>
              )}
              {participant.payment_notes && (
                <div className="text-xs text-muted-foreground">
                  Notes: {participant.payment_notes}
                </div>
              )}
            </div>
          )}

          {customFields && customFields.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">Additional Information</h3>
              <div className="text-sm space-y-0.5">
                {customFields.map((field) => (
                  <div key={field.id}>
                    {field.label}: {participant.responses[field.id || ''] || 'Not provided'}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">Labels</h3>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => {
                const hasLabel = participant.labels?.some((l) => l.id === label.id) || false;
                return (
                  <button
                    key={label.id}
                    onClick={() => onToggleLabel(participant, label)}
                    className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                      hasLabel
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
