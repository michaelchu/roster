import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

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
    <Drawer open={internalOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[80vh] max-h-[80vh]">{children}</DrawerContent>
    </Drawer>
  );
}
