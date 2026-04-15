/**
 * @file StressCheckInLight Component
 * @description Quick stress rating check-in for light mode
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { SliderInput } from "@/components/common/questions/SliderInput";
import { stressService, type CreateStressLogInput, type CheckInType } from "@/src/shared/services/stress.service";

interface StressCheckInLightProps {
  checkInType?: CheckInType;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StressCheckInLight({ checkInType = 'on_demand', onSuccess, onCancel }: StressCheckInLightProps) {
  const [stressRating, setStressRating] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateStressLogInput = {
        stressRating,
        checkInType,
        clientRequestId: stressService.generateClientRequestId(),
      };

      const response = await stressService.createLog(data);

      if (response.success) {
        onSuccess?.();
      } else {
        setError((response.error as { message?: string })?.message || "Failed to log stress");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to log stress");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    return stressService.getStressRatingLabel(stressRating);
  };

  const getRatingColor = () => {
    return stressService.getStressRatingColor(stressRating);
  };

  return (
    <div className="space-y-6">
      {/* Stress Rating */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-4">
          How stressed are you right now?
        </label>
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className={`text-6xl font-bold ${getRatingColor()}`}>
              {stressRating}
            </div>
            <div className="ml-4">
              <div className={`text-lg font-medium ${getRatingColor()}`}>
                {getRatingLabel()}
              </div>
            </div>
          </div>
          <SliderInput
            value={stressRating}
            onChange={setStressRating}
            min={1}
            max={10}
            step={1}
            showValue={false}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 px-2">
            <span>1 - No stress</span>
            <span>10 - Extreme</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border-white/20 hover:bg-white/10"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`flex-1 bg-gradient-to-r ${getRatingColor()} hover:opacity-90`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Log Stress
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

