import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingStates';

interface ActionButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  form?: string;
  children: React.ReactNode;
  loadingText?: string;
}

/**
 * Reusable action button component for consistent hover buttons across the app.
 * Positioned as a fixed button above the bottom navigation bar.
 */
export function ActionButton({
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  form,
  children,
  loadingText = 'Loading...',
}: ActionButtonProps) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
      <Button
        type={type}
        form={form}
        onClick={onClick}
        className="w-full text-white shadow-lg"
        disabled={loading || disabled}
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" />
            {loadingText}
          </>
        ) : (
          children
        )}
      </Button>
    </div>
  );
}
