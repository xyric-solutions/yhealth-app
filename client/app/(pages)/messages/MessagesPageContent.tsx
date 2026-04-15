'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/chat';

// Loading fallback component
function MessagesPageLoading() {
  return (
    <div className="flex h-[calc(100vh-0rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function MessagesPageInner() {
  // TODO: Implement full person-to-person messaging interface
  // This is a placeholder structure - full implementation would include:
  // - Chat list sidebar
  // - Message list
  // - Chat input with all features
  // - Integration with chatService

  return (
    <div className="flex h-[calc(100vh-0rem)] items-center justify-center p-8">
      <EmptyState
        title="Messages"
        description="Person-to-person messaging will be available here. This feature is coming soon."
      />
    </div>
  );
}

export default function MessagesPageContent() {
  return (
    <Suspense fallback={<MessagesPageLoading />}>
      <MessagesPageInner />
    </Suspense>
  );
}
