"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { activityStatusService, STATUS_CONFIG, type ActivityStatus } from "@/src/shared/services/activity-status.service";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "react-hot-toast";

interface StatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function StatusIndicator({ className = "", showLabel = false }: StatusIndicatorProps) {
  const [currentStatus, setCurrentStatus] = useState<ActivityStatus>("working");
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadCurrentStatus();
  }, []);

  const loadCurrentStatus = async () => {
    try {
      const response = await activityStatusService.getCurrent();
      if (response.success && response.data) {
        setCurrentStatus(response.data.status);
      } else {
        // If no status found, default to 'working'
        setCurrentStatus("working");
      }
    } catch (error) {
      console.error("Failed to load current status:", error);
      // Default to 'working' on error - always show something
      setCurrentStatus("working");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ActivityStatus) => {
    try {
      const response = await activityStatusService.updateCurrent(newStatus);
      if (response.success && response.data) {
        setCurrentStatus(newStatus);
        setIsOpen(false);
        toast.success("Status updated!");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    }
  };

  // Always show something, even if loading
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.working;
  
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        {showLabel && (
          <span className="text-sm font-medium capitalize text-muted-foreground">Loading...</span>
        )}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={`flex items-center gap-2 h-auto p-1.5 rounded-full hover:bg-primary/10 transition-all ${className}`}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {config.icon}
          </motion.div>
          {showLabel && (
            <span className="text-sm font-medium capitalize">{currentStatus}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-3">
          <div className="font-semibold text-sm mb-3">Update Activity Status</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <motion.button
                key={status}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleStatusChange(status as ActivityStatus)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  currentStatus === status
                    ? "border-primary bg-primary/10"
                    : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                }`}
                style={{
                  backgroundColor: currentStatus === status ? `${config.color}15` : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <div className="font-medium text-sm capitalize">{status}</div>
                    <div className="text-xs text-muted-foreground">{config.description}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

