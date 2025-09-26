import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import { TopNav } from '../TopNav';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TopNav', () => {
  it('renders title correctly', () => {
    render(<TopNav title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('shows back button when showBackButton is true', () => {
    render(<TopNav title="Test" showBackButton />);
    const backButton = screen.getByLabelText(/go back/i);
    expect(backButton).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    render(<TopNav title="Test" showBackButton />);
    const backButton = screen.getByLabelText(/go back/i);
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('applies sticky class when sticky prop is true', () => {
    const { container } = render(<TopNav title="Test" sticky />);
    const stickyDiv = container.querySelector('.sticky');
    expect(stickyDiv).toBeInTheDocument();
  });
});
