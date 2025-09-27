import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';

export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <TopNav title="Profile" showBackButton sticky />

      <div className="p-3 space-y-3">
        {/* Profile Header */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
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
        <div className="bg-white rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
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
