"use client";

import { usePathname } from "next/navigation";
import { FloatingVoiceAssistant } from "./floating-voice-assistant";

export function FloatingVoiceAssistantWrapper() {
  const pathname = usePathname();

  // Don't show on chat page
  if (pathname === "/chat") {
    return null;
  }

  return <FloatingVoiceAssistant />;
}

