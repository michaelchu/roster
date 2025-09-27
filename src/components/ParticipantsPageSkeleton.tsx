import { Skeleton } from '@/components/ui/skeleton';
import { TopNav } from '@/components/TopNav';
import { Search } from 'lucide-react';

/**
 * Render a skeleton UI for the "All Participants" page, including a top navigation, search bar placeholder, and a list of participant row placeholders.
 *
 * @returns A JSX element representing the participants page loading skeleton
 */
export function ParticipantsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <TopNav title="All Participants" sticky />

      <div className="p-3 space-y-3">
        {/* Search Bar */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Skeleton className="h-8 w-full rounded-md pl-9" />
            </div>
          </div>
        </div>

        {/* Participants List */}
        <div className="bg-white rounded-lg border divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
