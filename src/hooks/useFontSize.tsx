import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FontSize = 'sm' | 'md' | 'lg';

export interface FontSizeConfig {
  sm: string;
  md: string;
  lg: string;
}

const FONT_SIZE_CONFIG: FontSizeConfig = {
  sm: '16px',
  md: '18px',
  lg: '20px',
};

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Extra Large',
};

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontSizeConfig: FontSizeConfig;
  fontSizeLabels: Record<FontSize, string>;
  getFontSizeValue: (size: FontSize) => string;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const STORAGE_KEY = 'font-size-preference';

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('md');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedFontSize = window.localStorage.getItem(STORAGE_KEY) as FontSize | null;
      if (savedFontSize && Object.hasOwn(FONT_SIZE_CONFIG, savedFontSize)) {
        setFontSizeState(savedFontSize);
      }
    } catch {
      // localStorage may be unavailable (e.g., Safari private mode); fall back to defaults.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sizeValue = FONT_SIZE_CONFIG[fontSize];

    root.style.setProperty('--font-size-base', sizeValue);
    root.style.setProperty('--font-size-xs', `calc(${sizeValue} * 0.75)`);
    root.style.setProperty('--font-size-sm', `calc(${sizeValue} * 0.875)`);
    root.style.setProperty('--font-size-base-exact', sizeValue);
    root.style.setProperty('--font-size-lg', `calc(${sizeValue} * 1.125)`);
    root.style.setProperty('--font-size-2xl', `calc(${sizeValue} * 1.5)`);
    root.style.setProperty('--font-size-3xl', `calc(${sizeValue} * 1.875)`);
  }, [fontSize]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // Ignore write failures so UI updates still succeed when storage is blocked.
    }
  };

  const getFontSizeValue = (size: FontSize) => FONT_SIZE_CONFIG[size];

  const value: FontSizeContextType = {
    fontSize,
    setFontSize,
    fontSizeConfig: FONT_SIZE_CONFIG,
    fontSizeLabels: FONT_SIZE_LABELS,
    getFontSizeValue,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}