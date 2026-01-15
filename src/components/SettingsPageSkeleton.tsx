import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';

/**
 * Render a static skeleton UI for the Settings page shown while real content loads.
 *
 * @returns A JSX element that renders placeholder skeletons for the top navigation, user profile card, sign-out button, and an about section.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-14">
      <TopNav />

      <div className="p-3 space-y-3">
        {/* User Profile Section */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-muted">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          <div className="divide-y">
            <div className="p-3 flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div>
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="bg-card rounded-lg border p-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* About Section */}
        <div className="bg-card rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
