import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should show loading state while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      isAdmin: false,
      isImpersonating: false,
      impersonate: vi.fn(),
      stopImpersonating: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      isAdmin: false,
      isImpersonating: false,
      impersonate: vi.fn(),
      stopImpersonating: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
      isImpersonating: false,
      impersonate: vi.fn(),
      stopImpersonating: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should store return URL in localStorage when redirecting', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
      isImpersonating: false,
      impersonate: vi.fn(),
      stopImpersonating: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected?query=value']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(localStorage.getItem('returnUrl')).toBe('/protected?query=value');
  });
});
