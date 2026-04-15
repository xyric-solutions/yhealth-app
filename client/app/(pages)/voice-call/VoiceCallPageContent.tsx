"use client";

import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { DashboardLayout } from "@/components/layout";
import { VoiceCallTab } from "@/app/(pages)/dashboard/components/tabs/VoiceCallTab";

function VoiceCallLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function VoiceCallContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/signin?callbackUrl=/voice-call");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <DashboardLayout activeTab="voice-call">
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
    <DashboardLayout activeTab="voice-call">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <VoiceCallTab />
      </div>
    </DashboardLayout>
  );
}

export default function VoiceCallPageContent() {
  return (
    <Suspense fallback={<VoiceCallLoading />}>
      <VoiceCallContent />
    </Suspense>
  );
}
