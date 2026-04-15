/**
 * @file StressEveningPrompt Component
 * @description Component that prompts users to log evening stress check-ins
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stressService } from "@/src/shared/services/stress.service";

interface StressEveningPromptProps {
  onCheckInClick?: () => void;
}

export function StressEveningPrompt({ onCheckInClick }: StressEveningPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if it's evening (6 PM - 11 PM)
    const checkEveningTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const isEvening = hour >= 18 && hour < 23;

      if (isEvening && !isDismissed) {
        // Check if user has already logged today
        // eslint-disable-next-line react-hooks/immutability
        checkTodayLogs();
      } else {
        setShowPrompt(false);
      }
    };

    checkEveningTime();
    const interval = setInterval(checkEveningTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isDismissed]);

  const checkTodayLogs = async () => {
    try {
      const result = await stressService.getTodayLogs();
      // Show prompt if no logs today or no daily check-in yet
      const hasDailyCheckIn = result.data?.some((log) => log.checkInType === "daily");
      setShowPrompt(!hasDailyCheckIn);
    } catch (error) {
      console.error("Failed to check today's logs:", error);
    }
  };

  if (!showPrompt || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="p-4 rounded-lg bg-purple-600/20 border border-purple-500/30"
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <Moon className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white mb-1">
              Evening Check-in
            </h4>
            <p className="text-xs text-purple-200">
              How was your stress level today?
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onCheckInClick && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCheckInClick}
                className="text-purple-300 hover:text-white hover:bg-purple-500/30"
              >
                Check In
              </Button>
            )}
            <button
              onClick={() => setIsDismissed(true)}
              className="text-purple-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

