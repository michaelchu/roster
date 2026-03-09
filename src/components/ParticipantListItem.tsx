import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { UserAvatar } from '@/components/UserAvatar';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { DollarSign, Trash2, UserPlus } from 'lucide-react';
import type { Participant as ServiceParticipant, Label as LabelType } from '@/services';

type Participant = ServiceParticipant & {
  notes?: string | null;
  user_id?: string | null;
};

interface ParticipantListItemProps {
  participant: Participant;
  displayName: string;
  displayNumber: number;
  isOrganizer: boolean;
  isOrganizerItem: boolean;
  isOwnClaimedSpot: boolean;
  claimNumber: string | null;
  isPaid: boolean;
  isArchived: boolean;
  showRegistrationForm: boolean;
  onSelect: (participant: Participant) => void;
  onTogglePayment: (participant: Participant) => void | Promise<void>;
  onWithdraw: (participant: Participant) => void;
}

/**
 * Renders a single participant row in the event detail page's participant list.
 * Handles display of participant info, badges, payment status, and action buttons.
 */
export function ParticipantListItem({
  participant,
  displayName,
  displayNumber,
  isOrganizer,
  isOrganizerItem,
  isOwnClaimedSpot,
  claimNumber,
  isPaid,
  isArchived,
  showRegistrationForm,
  onSelect,
  onTogglePayment,
  onWithdraw,
}: ParticipantListItemProps) {
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);

  const handleTogglePayment = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTogglingPayment(true);
    try {
      await onTogglePayment(participant);
    } finally {
      setIsTogglingPayment(false);
    }
  };

  return (
    <div
      className={`px-3 py-2 hover:bg-muted transition-colors ${isOrganizerItem ? 'bg-primary/5' : isOwnClaimedSpot ? 'bg-blue-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground font-mono flex-shrink-0">
          {displayNumber}.
        </div>
        <UserAvatar name={displayName} avatarUrl={participant.avatar_url} size="sm" />
        <div className="flex-1 min-w-0 flex justify-between items-center gap-2">
          {/* Left column: name, badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {showRegistrationForm ? (
                <button
                  onClick={() => onSelect(participant)}
                  className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors truncate text-left min-w-0 max-w-full"
                >
                  {displayName}
                </button>
              ) : (
                <span className="text-sm font-medium text-foreground truncate min-w-0 max-w-full">
                  {displayName}
                </span>
              )}
              {isOrganizerItem && (
                <span className="flex-shrink-0 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200/50 bg-clip-padding">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-medium">
                    Organizer
                  </span>
                </span>
              )}
              {isOwnClaimedSpot && claimNumber && (
                <Badge variant="outline" className="text-xs h-5 px-1">
                  +{claimNumber}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {participant.labels?.map((label: LabelType) => (
                <Badge key={label.id} variant="outline" className="text-xs h-5">
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>
          {/* Right column: badges and action buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            {isPaid && isOrganizer && participant.payment_status !== 'pending' && (
              <button onClick={handleTogglePayment} disabled={isTogglingPayment}>
                {isTogglingPayment ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <PaymentStatusBadge status={participant.payment_status} size="sm" />
                )}
              </button>
            )}
            {isOrganizer && participant.payment_status === 'pending' && (
              <div className="flex gap-2">
                {isPaid && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleTogglePayment}
                    disabled={isTogglingPayment}
                    className="h-8 w-8"
                    title="Mark Paid"
                  >
                    {isTogglingPayment ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {!isOrganizerItem && !isArchived && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWithdraw(participant);
                    }}
                    className="h-8 w-8 text-destructive border-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptySlotProps {
  slotNumber: number;
  canClaimSpot: boolean;
  onClaim: () => void;
}

/**
 * Renders an empty/available slot in the participant list.
 */
export function EmptySlot({ slotNumber, canClaimSpot, onClaim }: EmptySlotProps) {
  return (
    <div className="p-3 border-dashed border-border">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground font-mono flex-shrink-0">{slotNumber}.</div>
        <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-muted-foreground">?</span>
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="text-sm text-muted-foreground italic">Available slot</div>
          {canClaimSpot && (
            <Button size="sm" variant="outline" onClick={onClaim} className="text-xs h-6 px-2">
              <UserPlus className="h-3 w-3 mr-1" />
              Claim
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
