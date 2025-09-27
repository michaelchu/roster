import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

/**
 * Render a skeleton loading UI for the signup page.
 *
 * Produces a static layout of skeleton placeholders that mimic the header, event information card,
 * and registration form while real content is loading.
 *
 * @returns A React element representing the signup page skeleton UI
 */
export function SignupPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center text-primary">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </div>
          <Skeleton className="h-6 w-32 mx-auto" />
          <div className="w-16"></div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Event Info Card Skeleton */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 space-y-2">
            {/* Top row: Date and Participants */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="text-sm">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-4 w-12" />
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
        </div>

        {/* Registration Form Skeleton */}
        <div className="bg-card rounded-lg border">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>

            <div className="space-y-4">
              {/* Name field */}
              <div>
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>

              {/* Email field */}
              <div>
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>

              {/* Phone field */}
              <div>
                <Skeleton className="h-4 w-12 mb-1" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>

              {/* Custom fields */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}

              {/* Submit Button */}
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            {/* Footer text */}
            <Skeleton className="h-3 w-64 mx-auto mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
