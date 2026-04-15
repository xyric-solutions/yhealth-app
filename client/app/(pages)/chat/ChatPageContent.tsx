'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { ChatList } from './components/ChatList';
import { MessagesView } from './components/MessagesView';
import { cn } from '@/lib/utils';
import { initSocket } from '@/lib/socket-client';

export function ChatPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      initSocket();
    }
  }, [isAuthenticated, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin?callbackUrl=/chat');
    }
  }, [isAuthenticated, authLoading, router]);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex h-full w-[340px] xl:w-[380px] flex-col border-r border-white/[0.04] bg-slate-900/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="px-4 pb-3">
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="flex-1 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 rounded" style={{ width: `${60 + (i % 3) * 20}px` }} />
                  <Skeleton className="h-3 rounded" style={{ width: `${120 + (i % 4) * 30}px` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Messages area skeleton */}
        <div className="flex flex-1 flex-col min-w-0 bg-slate-950">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04]">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <div className="flex-1 px-4 py-6 space-y-5">
            <div className="flex items-end gap-2.5 max-w-[70%]">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-14 w-48 rounded-2xl rounded-bl-md" />
            </div>
            <div className="flex justify-end max-w-[70%] ml-auto">
              <Skeleton className="h-10 w-40 rounded-2xl rounded-br-md" />
            </div>
            <div className="flex items-end gap-2.5 max-w-[70%]">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-20 w-60 rounded-2xl rounded-bl-md" />
            </div>
          </div>
          <div className="px-4 py-3 border-t border-white/[0.04]">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950">
      {/* Overlay for mobile when sidebar is open */}
      {showSidebar && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-20 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Chat List Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: showSidebar ? 0 : '-100%',
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={cn(
          'flex h-full flex-col',
          'bg-slate-900/95 backdrop-blur-xl border-r border-white/[0.04]',
          'lg:w-[340px] xl:w-[380px] lg:relative lg:translate-x-0',
          showSidebar
            ? 'fixed inset-y-0 left-0 w-[85vw] max-w-[380px] z-30 shadow-2xl shadow-black/10'
            : 'fixed inset-y-0 left-0 w-[85vw] max-w-[380px] z-30'
        )}
      >
        <ChatList
          selectedChatId={selectedChatId}
          onSelectChat={(chatId) => {
            setSelectedChatId(chatId);
            if (window.innerWidth < 1024) {
              setShowSidebar(false);
            }
          }}
          refreshTrigger={chatListRefreshTrigger}
        />
      </motion.div>

      {/* Messages View */}
      <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-950">
        <MessagesView
          chatId={selectedChatId}
          onBack={() => {
            router.push('/dashboard');
          }}
          onMenuClick={() => {
            setShowSidebar(true);
          }}
          onChatDeleted={() => {
            setSelectedChatId(null);
          }}
          onChatRead={() => {
            setChatListRefreshTrigger((prev) => prev + 1);
          }}
        />
      </div>
    </div>
  );
}

