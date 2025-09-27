import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

export function MobileOnly({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // Mobile if less than 768px (tablet breakpoint)
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Smartphone className="w-24 h-24 mx-auto text-muted-foreground mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Mobile Access Only</h1>
          <p className="text-muted-foreground">
            This platform is designed for mobile use only. Please open this page on your phone to
            continue.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
