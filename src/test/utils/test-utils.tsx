/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { FeatureFlagsProvider } from '@/hooks/useFeatureFlags';

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
