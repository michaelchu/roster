import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TopNav } from '../TopNav';

// Mock useAuth to avoid Supabase dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Custom render function with BrowserRouter
const customRender = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('TopNav', () => {
  it('renders title correctly', () => {
    customRender(<TopNav title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('shows back button when showBackButton is true', () => {
    customRender(<TopNav title="Test" showBackButton />);
    const backButton = screen.getByLabelText(/go back/i);
    expect(backButton).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    customRender(<TopNav title="Test" showBackButton />);
    const backButton = screen.getByLabelText(/go back/i);
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('applies sticky class when sticky prop is true', () => {
    const { container } = customRender(<TopNav title="Test" sticky />);
    const stickyDiv = container.querySelector('.sticky');
    expect(stickyDiv).toBeInTheDocument();
  });
});
