import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';

/**
 * Render a full-page skeleton UI for the event detail screen.
 *
 * Renders placeholder skeletons for the header, event info card (date, registration, location, description, and action buttons),
 * participants list (items and empty slots), and a fixed bottom join-event button to represent loading state.
 *
 * @returns A JSX element containing the skeleton placeholders for the event detail layout
 */
export function EventDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav sticky />

      <div className="p-3 space-y-3">
        {/* Event Info Card Skeleton */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 space-y-2">
            {/* Top row: Date and Registration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="text-sm">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>

            {/* Location */}
            <div className="text-sm">
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Divider */}
            <div className="border-t border-border"></div>

            {/* Description */}
            <div className="text-sm">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="border-t bg-muted">
            <div className="flex divide-x divide-border">
              <div className="flex-1 flex items-center justify-center py-2 px-3">
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="flex-1 flex items-center justify-center py-2 px-3">
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="flex-1 flex items-center justify-center py-2 px-3">
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        </div>

        {/* Participants List Skeleton */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex border border-border rounded">
              <Skeleton className="h-7 w-7 rounded-r-none" />
              <Skeleton className="h-7 w-7 rounded-l-none" />
            </div>
          </div>

          {/* Participant Items */}
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-3 w-4 mt-1" />
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-20 mt-1" />
                    <div className="flex gap-1 mt-1">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`empty-${i}`} className="p-3 border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-4" />
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join Event Button Skeleton */}
      <div className="fixed left-0 right-0 z-40 px-4 pb-2 bottom-16">
        <Skeleton className="w-full h-11 rounded-md" />
      </div>
    </div>
  );
}
