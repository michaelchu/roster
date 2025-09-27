import { Skeleton } from '@/components/ui/skeleton';

export function EventCardSkeleton() {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="p-3">
        <div className="mb-3">
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="border-t px-3 py-2 bg-gray-50 flex justify-between items-center gap-2">
        <Skeleton className="h-6 w-12 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
    </div>
  );
}

export function EventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ParticipantRowSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex gap-1 mt-2">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ParticipantListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ParticipantRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="p-3">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Inline loading spinner for buttons and small components
export function LoadingSpinner({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 ${sizeClasses[size]}`}
    />
  );
}

// Skeleton for upcoming events on HomePage
export function UpcomingEventSkeleton() {
  return (
    <div className="w-full p-3 border-b last:border-b-0">
      <div className="flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-end justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function UpcomingEventsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <UpcomingEventSkeleton key={i} />
      ))}
    </div>
  );
}

// Loading overlay for full screen loading
export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
