/**
 * @file StressCrisisBanner Component
 * @description Banner component that displays crisis-level stress alerts
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stressService, type ExtremeStressStatus } from "@/src/shared/services/stress.service";

export function StressCrisisBanner() {
  const [extremeStatus, setExtremeStatus] = useState<ExtremeStressStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    loadExtremeStatus();
  }, []);

  const loadExtremeStatus = async () => {
    setIsLoading(true);
    try {
      const result = await stressService.getExtremeStressStatus();
      if (result.success && result.data?.hasExtremeStreak) {
        setExtremeStatus(result.data);
      }
    } catch (error) {
      console.error("Failed to load extreme stress status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !extremeStatus || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      {extremeStatus.hasExtremeStreak && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative p-4 rounded-lg bg-gradient-to-r from-red-600/20 to-orange-600/20 border-2 border-red-500/50 shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                High Stress Alert
              </h3>
              <p className="text-sm text-red-200 mb-3">
                You&apos;ve reported high stress levels for {extremeStatus.consecutiveDays} consecutive day(s).
                Consider reaching out for support.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-400/50 hover:bg-red-500/20 text-white"
                  onClick={() => {
                    window.open("tel:988", "_self");
                  }}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Crisis Hotline (988)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-300 hover:text-white hover:bg-red-500/20"
                  onClick={() => setIsDismissed(true)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="flex-shrink-0 text-red-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

