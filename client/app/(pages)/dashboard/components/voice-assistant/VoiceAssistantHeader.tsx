"use client";

import { motion } from "framer-motion";
import { MessageSquare, Volume2, VolumeX, X, PhoneOff, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { LanguageSelector } from "@/components/common/language-selector";

interface VoiceAssistantHeaderProps {
  user: {
    firstName?: string | null;
  } | null;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  isTTSEnabled: boolean;
  setIsTTSEnabled: (enabled: boolean) => void;
  getInitials: () => string;
  isCallActive?: boolean;
  onEndCall?: () => void;
  showCamera?: boolean;
  onToggleCamera?: () => void;
}

export function VoiceAssistantHeader({
  user,
  selectedLanguage,
  setSelectedLanguage,
  isTTSEnabled,
  setIsTTSEnabled,
  getInitials,
  isCallActive,
  onEndCall,
  showCamera,
  onToggleCamera,
}: VoiceAssistantHeaderProps) {
  const router = useRouter();
  const userName = user?.firstName || null;
  const userInitials = getInitials();

  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative z-[99999999] flex items-center justify-between p-4 sm:p-6"
      style={{ background: "rgba(11, 15, 20, 0.4)" }}
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/ai-coach")}
        className="flex items-center gap-2 px-4 py-2.5 backdrop-blur-xl rounded-lg text-white border transition-all"
        style={{
          background: "rgba(11, 15, 20, 0.6)",
          borderColor: "rgba(0, 229, 255, 0.2)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.2)";
        }}
      >
        <MessageSquare className="w-4 h-4" style={{ color: "#00E5FF" }} />
        <span className="text-sm font-medium hidden sm:inline" style={{ color: "#E0E0E0" }}>Text</span>
      </motion.button>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Selector */}
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          compact={true}
          showPreview={false}
        />

        {/* Camera Toggle */}
        {onToggleCamera && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleCamera}
            className="p-2.5 sm:p-3 rounded-lg backdrop-blur-xl border transition-all"
            style={
              showCamera
                ? {
                    background: "rgba(0, 229, 255, 0.15)",
                    borderColor: "rgba(0, 229, 255, 0.3)",
                    color: "#00E5FF",
                  }
                : {
                    background: "rgba(11, 15, 20, 0.6)",
                    borderColor: "rgba(0, 229, 255, 0.2)",
                    color: "#888",
                  }
            }
            onMouseEnter={(e) => {
              if (!showCamera) {
                e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showCamera) {
                e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.2)";
              }
            }}
            title="Toggle Camera"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        )}

        {/* TTS Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsTTSEnabled(!isTTSEnabled)}
          className="p-2.5 sm:p-3 rounded-lg backdrop-blur-xl border transition-all"
          style={
            isTTSEnabled
              ? {
                  background: "rgba(29, 233, 182, 0.15)",
                  borderColor: "rgba(29, 233, 182, 0.3)",
                  color: "#1DE9B6",
                }
              : {
                  background: "rgba(11, 15, 20, 0.6)",
                  borderColor: "rgba(0, 229, 255, 0.2)",
                  color: "#888",
                }
          }
          onMouseEnter={(e) => {
            if (!isTTSEnabled) {
              e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isTTSEnabled) {
              e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.2)";
            }
          }}
        >
          {isTTSEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
        </motion.button>

        {/* Close Button - Redirects to overview page */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/dashboard?tab=overview")}
          className="p-2.5 sm:p-3 rounded-lg backdrop-blur-xl border transition-all"
          style={{
            background: "rgba(11, 15, 20, 0.6)",
            borderColor: "rgba(0, 229, 255, 0.2)",
            color: "#E0E0E0",
          }}
          title="Close"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.2)";
          }}
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.button>

        {/* End Call Button - Only show when there's an active call */}
        {isCallActive && onEndCall && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEndCall}
            className="flex items-center gap-2 px-4 py-2.5 backdrop-blur-xl rounded-lg border transition-all"
            style={{
              background: "rgba(220, 38, 38, 0.15)",
              borderColor: "rgba(220, 38, 38, 0.3)",
              color: "#F87171",
            }}
            title="End Call"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm font-medium hidden sm:inline">End Call</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

