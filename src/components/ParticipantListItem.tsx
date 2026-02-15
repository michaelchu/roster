import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/UserAvatar';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { DollarSign, Trash2, UserX, UserPlus } from 'lucide-react';
import type { Participant as ServiceParticipant, Label as LabelType } from '@/services';

type Participant = ServiceParticipant & {
  notes?: string | null;
  user_id?: string | null;
};

interface ParticipantListItemProps {
  participant: Participant;
  displayName: string;
  isOrganizer: boolean;
  isOrganizerItem: boolean;
  isOwnClaimedSpot: boolean;
  claimNumber: string | null;
  isPaid: boolean;
  showRegistrationForm: boolean;
  onSelect: (participant: Participant) => void;
  onTogglePayment: (participant: Participant) => void;
  onWithdraw: (participant: Participant) => void;
}

/**
 * Renders a single participant row in the event detail page's participant list.
 * Handles display of participant info, badges, payment status, and action buttons.
 */
export function ParticipantListItem({
  participant,
  displayName,
  isOrganizer,
  isOrganizerItem,
  isOwnClaimedSpot,
  claimNumber,
  isPaid,
  showRegistrationForm,
  onSelect,
  onTogglePayment,
  onWithdraw,
}: ParticipantListItemProps) {
  const formatSignupTime = (createdAt: string) => {
    const now = new Date();
    const signupTime = new Date(createdAt);
    const diffMs = now.getTime() - signupTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return `on ${signupTime.toLocaleDateString()}`;
    }
  };

  return (
    <div
      className={`px-3 py-2 hover:bg-muted transition-colors ${isOrganizerItem ? 'bg-primary/5' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground font-mono flex-shrink-0">
          {participant.slot_number}.
        </div>
        <UserAvatar name={displayName} avatarUrl={participant.avatar_url} size="sm" />
        <div className="flex-1 min-w-0 flex justify-between items-center gap-2">
          {/* Left column: name, badges, signup time */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
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
              {isOwnClaimedSpot && claimNumber && (
                <Badge variant="outline" className="text-xs h-5 px-1">
                  +{claimNumber}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground -mt-1">
              Signed up {formatSignupTime(participant.created_at)}
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
            {isOrganizerItem && (
              <Badge
                variant="outline"
                className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200/50 text-xs"
              >
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-medium">
                  Organizer
                </span>
              </Badge>
            )}
            {isPaid &&
              isOrganizer &&
              participant.payment_status !== 'pending' &&
              !isOrganizerItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePayment(participant);
                  }}
                >
                  <PaymentStatusBadge status={participant.payment_status} size="sm" />
                </button>
              )}
            {isOrganizer &&
              !isOrganizerItem &&
              (isPaid ? participant.payment_status === 'pending' : true) && (
                <div className="flex gap-2">
                  {isPaid && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePayment(participant);
                      }}
                      className="h-8 w-8"
                      title="Mark Paid"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  )}
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
                </div>
              )}
            {isOwnClaimedSpot && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onWithdraw(participant);
                }}
                className="text-xs h-6 px-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              >
                <UserX className="h-3 w-3 mr-1" />
                Withdraw
              </Button>
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
  onClaim: (slotNumber: number) => void;
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => onClaim(slotNumber)}
              className="text-xs h-6 px-2"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Claim
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
