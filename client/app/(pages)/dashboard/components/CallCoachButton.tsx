"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Loader2, AlertCircle } from "lucide-react";
import { voiceCallService, type CallChannel, type CallPurpose } from "@/src/shared/services/voice-call.service";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface CallCoachButtonProps {
  channel?: CallChannel;
  preCallContext?: string;
  callPurpose?: CallPurpose;
  className?: string;
  size?: "sm" | "md" | "lg";
  onCallInitiated?: (callId: string) => void;
}

export function CallCoachButton({
  channel = "mobile_app",
  preCallContext,
  callPurpose,
  className = "",
  size = "md",
  onCallInitiated,
}: CallCoachButtonProps) {
  const { user } = useAuth();
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCall = async () => {
    if (!user) {
      toast.error("Please sign in to call your coach");
      return;
    }

    if (isCalling) {
      return; // Prevent multiple simultaneous calls
    }

    setIsCalling(true);
    setError(null);

    try {
      const response = await voiceCallService.initiate({
        channel,
        pre_call_context: preCallContext,
        call_purpose: callPurpose,
      });

      if (response.success && response.data) {
        toast.success("Call connecting...");
        console.log("Call initiated:", response.data);
        // Call the callback if provided
        if (onCallInitiated && response.data.callId) {
          onCallInitiated(response.data.callId);
        }
      } else {
        throw new Error(response.error?.message || "Failed to initiate call");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start call. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCalling(false);
    }
  };

  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-xs",
    lg: "h-10 sm:h-11 md:h-12 px-4 sm:px-5 md:px-6 text-xs",
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          onClick={handleCall}
          disabled={isCalling}
          className={`${sizeClasses[size]} bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg transition-all duration-200 flex items-center gap-2`}
        >
          {isCalling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span style={{ fontSize: '12px' }}>Connecting...</span>
            </>
          ) : (
            <>
              <Phone className="w-4 h-4" />
              <span style={{ fontSize: '12px' }}>Call Coach</span>
            </>
          )}
        </Button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
}

