'use client';

import { MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'Start a conversation',
  description = 'Send a message to get started',
  suggestions = [],
  onSuggestionClick,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      {icon || (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
      )}
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-2 text-muted-foreground max-w-md">{description}</p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 w-full max-w-xl">
          <p className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Try asking about:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                onClick={() => onSuggestionClick?.(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

