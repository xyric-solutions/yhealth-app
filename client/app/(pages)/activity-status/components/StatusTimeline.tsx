"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, MessageSquare } from "lucide-react";
import { activityStatusService, STATUS_CONFIG, type ActivityStatusHistory } from "@/src/shared/services/activity-status.service";
import { automationService, type AutomationLog } from "@/src/shared/services/automation.service";
import { StatusPickerModal } from "./StatusPickerModal";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export function StatusTimeline() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<ActivityStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ActivityStatusHistory | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [automationSettings, setAutomationSettings] = useState<{ activityAutomationEnabled: boolean } | null>(null);

  useEffect(() => {
    loadHistory();
    loadAutomationData();
  }, []);

  const loadAutomationData = async () => {
    try {
      // Load automation settings
      const settingsResponse = await automationService.getSettings();
      if (settingsResponse.success && settingsResponse.data) {
        setAutomationSettings({
          activityAutomationEnabled: settingsResponse.data.activityAutomationEnabled,
        });
      }

      // Load recent automation logs
      const logsResponse = await automationService.getLogs({ limit: 20 });
      if (logsResponse.success && logsResponse.data) {
        const allLogs = [...logsResponse.data.scheduleLogs, ...logsResponse.data.activityLogs];
        setAutomationLogs(allLogs);
      }
    } catch (error) {
      // Silently fail - automation data is optional
      console.error("Failed to load automation data:", error);
    }
  };

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      // Format dates using local timezone, not UTC
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const response = await activityStatusService.getHistory({
        startDate: formatLocalDate(startDate),
        endDate: formatLocalDate(endDate),
        limit: 50,
      });

      if (response.success && response.data !== undefined) {
        // Server returns paginated format: data is the array directly (not data.statuses)
        const items = Array.isArray(response.data)
          ? response.data
          : (response.data as { statuses?: ActivityStatusHistory[] })?.statuses ?? [];
        setStatuses(items);
      } else {
        setStatuses([]);
      }
    } catch (_error) {
      toast.error("Failed to load status history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusClick = (status: ActivityStatusHistory) => {
    setSelectedStatus(status);
    setIsPickerOpen(true);
  };

  const handleStatusUpdate = () => {
    loadHistory();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Ensure statuses is always an array
  if (!statuses || statuses.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No status history yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Start tracking your activity status to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(statuses || []).map((status, index) => {
        const config = STATUS_CONFIG[status.activity_status];
        const date = new Date(status.status_date);
        const formattedDate = date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return (
          <motion.div
            key={status.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => handleStatusClick(status)}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-primary/50 transition-all"
          >
            <div className="flex items-center gap-4">
              {/* Status Icon */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: `${config.color}20`, color: config.color }}
              >
                {config.icon}
              </div>

              {/* Status Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold capitalize">{status.activity_status}</h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    {config.description}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
                {status.mood && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm">
                      {["😞", "😐", "😊", "😄", "🌟"][status.mood - 1]}
                    </span>
                    <span className="text-xs text-muted-foreground">Mood: {status.mood}/5</span>
                  </div>
                )}
                {status.notes && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {status.notes}
                  </p>
                )}
                {/* Automation Status */}
                {automationSettings?.activityAutomationEnabled && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>AI automation enabled</span>
                    </div>
                    {automationLogs.some(
                      (log) =>
                        log.sourceType === 'activity_log' &&
                        new Date(log.sentAt).toDateString() === date.toDateString()
                    ) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/chat');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View messages
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </motion.div>
        );
      })}

      {/* Status Picker Modal */}
      {selectedStatus && (
        <StatusPickerModal
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          date={selectedStatus.status_date}
          initialStatus={selectedStatus.activity_status}
          initialMood={selectedStatus.mood}
          initialNotes={selectedStatus.notes}
          onSuccess={handleStatusUpdate}
        />
      )}
    </div>
  );
}

