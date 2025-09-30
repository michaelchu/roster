import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';

/**
 * Render a skeleton UI for the Profile page while profile data is loading.
 *
 * Renders placeholder skeletons for the profile header (avatar, name, subtitle),
 * full name and email fields, an account information block, and a fixed bottom
 * save button to match the page layout during loading.
 *
 * @returns A JSX element with skeleton placeholders for the profile header, account information, and a fixed bottom save button.
 */
export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="Profile" showBackButton sticky />

      <div className="p-3 space-y-3">
        {/* Profile Header */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-muted">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div>
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Full Name */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-card rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2">
        <Skeleton className="w-full h-9 rounded-md" />
      </div>
    </div>
  );
}
