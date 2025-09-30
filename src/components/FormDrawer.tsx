import React from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function FormDrawer({ open, onOpenChange, children, footer, className }: FormDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('max-h-[90vh] p-0', className)}>
        <div className="overflow-y-auto flex-1 px-3">{children}</div>
        {footer && (
          <>
            <div className="border-t border-border"></div>
            <div className="p-3">{footer}</div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
