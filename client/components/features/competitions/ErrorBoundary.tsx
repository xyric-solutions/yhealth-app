'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.FallbackComponent;
      return <Fallback error={this.state.error} resetError={this.reset} />;
    }

    return <>{this.props.children}</>;
  }
}

export function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
      <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
      <p className="text-gray-400 mb-4">{error.message}</p>
      <Button onClick={resetError} variant="outline">
        Try again
      </Button>
    </div>
  );
}
