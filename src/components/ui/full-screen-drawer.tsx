import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

interface FullScreenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function FullScreenDrawer({ open, onOpenChange, children }: FullScreenDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(open);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setInternalOpen(true);
      isClosingRef.current = false;
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isClosingRef.current) {
      isClosingRef.current = true;
      setInternalOpen(false);
      // Wait for animation to complete before navigating
      setTimeout(() => {
        onOpenChange(false);
      }, 300);
    }
  };

  return (
    <DrawerPrimitive.Root open={internalOpen} onOpenChange={handleOpenChange}>
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
