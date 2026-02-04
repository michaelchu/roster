import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

interface FullScreenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function FullScreenDrawer({ open, onOpenChange, children }: FullScreenDrawerProps) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DrawerPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-xl bg-background',
            'focus:outline-none'
          )}
        >
          {/* Small drag handle at top for visual affordance */}
          <div className="flex justify-center pt-2 pb-0">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          </div>
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
