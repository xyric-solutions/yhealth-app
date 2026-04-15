/**
 * @file LoadingScreen component tests
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { LoadingScreen } from '@/components/common/loading-screen';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('LoadingScreen', () => {
  it('renders with default message', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingScreen message="Loading your dashboard..." />);
    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
  });

  it('renders without message when empty string provided', () => {
    render(<LoadingScreen message="" />);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('applies dark variant classes by default', () => {
    const { container } = render(<LoadingScreen />);
    expect(container.firstChild).toHaveClass('bg-slate-950');
  });

  it('applies light variant classes', () => {
    const { container } = render(<LoadingScreen variant="light" />);
    expect(container.firstChild).toHaveClass('bg-white');
  });

  it('applies transparent variant classes', () => {
    const { container } = render(<LoadingScreen variant="transparent" />);
    expect(container.firstChild).toHaveClass('bg-transparent');
  });

  it('applies fullScreen classes by default', () => {
    const { container } = render(<LoadingScreen />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });

  it('does not apply fullScreen classes when disabled', () => {
    const { container } = render(<LoadingScreen fullScreen={false} />);
    expect(container.firstChild).not.toHaveClass('min-h-screen');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingScreen className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
