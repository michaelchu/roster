import { Label } from '@/components/ui/label';
import { Lock, Unlock } from 'lucide-react';

interface PrivacyToggleProps {
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
}

/**
 * Toggle component for event privacy settings.
 * Displays a styled button that toggles between public and private states.
 */
export function PrivacyToggle({ isPrivate, onChange }: PrivacyToggleProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">Event Privacy</Label>
      <button
        type="button"
        onClick={() => onChange(!isPrivate)}
        className={`flex items-center justify-between w-full p-2 rounded-lg border-2 transition-colors ${
          isPrivate ? 'border-destructive/20 bg-destructive/5' : 'border-primary/20 bg-primary/5'
        }`}
      >
        <div className="flex items-center space-x-2">
          {isPrivate ? (
            <Lock className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Unlock className="h-3.5 w-3.5 text-primary" />
          )}
          <span
            className={`text-sm font-medium ${isPrivate ? 'text-destructive' : 'text-primary'}`}
          >
            {isPrivate ? 'Private Event' : 'Public Event'}
          </span>
        </div>
      </button>
      <p className="text-xs text-muted-foreground">
        {isPrivate
          ? 'Only people you invite can view and sign up for this event'
          : 'Anyone with the link can view and sign up for this event'}
      </p>
    </div>
  );
}
