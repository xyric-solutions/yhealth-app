/**
 * @file ErrorState component tests
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '@/components/common/error-state';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('ErrorState', () => {
  it('renders with default title', () => {
    render(<ErrorState message="An error occurred" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<ErrorState title="Custom Error" message="An error occurred" />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<ErrorState message="Failed to load data" />);
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom retry text', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Error" onRetry={onRetry} retryText="Retry Now" />);
    expect(screen.getByText('Retry Now')).toBeInTheDocument();
  });

  it('renders back button when onBack provided', () => {
    const onBack = jest.fn();
    render(<ErrorState message="Error" onBack={onBack} />);
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = jest.fn();
    render(<ErrorState message="Error" onBack={onBack} />);

    fireEvent.click(screen.getByText('Go Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('does not render back button when onBack not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByText('Go Back')).not.toBeInTheDocument();
  });

  it('applies dark variant classes by default', () => {
    const { container } = render(<ErrorState message="Error" />);
    expect(container.firstChild).toHaveClass('bg-slate-950');
  });

  it('applies light variant classes', () => {
    const { container } = render(<ErrorState message="Error" variant="light" />);
    expect(container.firstChild).toHaveClass('bg-white');
  });

  it('applies fullScreen classes by default', () => {
    const { container } = render(<ErrorState message="Error" />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });

  it('does not apply fullScreen classes when disabled', () => {
    const { container } = render(<ErrorState message="Error" fullScreen={false} />);
    expect(container.firstChild).not.toHaveClass('min-h-screen');
  });

  it('renders both buttons when both callbacks provided', () => {
    render(
      <ErrorState
        message="Error"
        onRetry={() => {}}
        onBack={() => {}}
      />
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });
});
