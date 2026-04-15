"use client";

import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { DashboardLayout } from "@/components/layout";
import { ChatHistoryTab } from "@/app/(pages)/dashboard/components/tabs/ChatHistoryTab";

function ChatHistoryLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ChatHistoryContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/signin?callbackUrl=/chat-history");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <DashboardLayout activeTab="chat-history">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-slate-400">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout activeTab="chat-history">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <ChatHistoryTab />
      </div>
    </DashboardLayout>
  );
}

export default function ChatHistoryPageContent() {
  return (
    <Suspense fallback={<ChatHistoryLoading />}>
      <ChatHistoryContent />
    </Suspense>
  );
}
