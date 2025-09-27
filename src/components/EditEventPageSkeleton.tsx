import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';

/**
 * Renders a skeleton placeholder layout for the "Edit Event" page.
 *
 * Provides skeleton blocks for the top navigation, basic event information, participants list,
 * privacy settings, custom fields, delete controls, and a fixed save button to indicate loading state.
 *
 * @returns The React element tree representing the edit-event page skeleton.
 */
export function EditEventPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="Edit Event" showBackButton sticky />

      <div className="p-3 space-y-3">
        {/* Basic Event Info */}
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>

        {/* Custom Fields */}
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>

          {/* Sample custom fields */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Delete Section */}
        <div className="bg-card rounded-lg p-3 border">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Skeleton className="w-full h-11 rounded-md" />
      </div>
    </div>
  );
}
