/**
 * @file MoodCheckIn Component
 * @description Unified mood check-in modal with light/deep mode switching
 */

"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoodCheckInLight } from "./MoodCheckInLight";
import { MoodCheckInDeep } from "./MoodCheckInDeep";
import { moodService } from "@/src/shared/services/wellbeing.service";
import type { MoodLog } from "@shared/types/domain/wellbeing";
import { Clock } from "lucide-react";
import { format } from "date-fns";

interface MoodCheckInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "light" | "deep";
}

export function MoodCheckIn({
  open,
  onOpenChange,
  initialMode = "light",
}: MoodCheckInProps) {
  const [mode, setMode] = useState<"light" | "deep">(initialMode);
  const [todayLogs, setTodayLogs] = useState<MoodLog[]>([]);
  const [_isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (open) {
      loadTodayLogs();
    }
  }, [open]);

  const loadTodayLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await moodService.getLogs({ startDate: today, endDate: today });
      if (result.success && result.data) {
        setTodayLogs(result.data.logs);
      }
    } catch (error) {
      console.error("Failed to load today's logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSuccess = () => {
    loadTodayLogs();
    // Trigger a page refresh to update timeline
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mood-logged'));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">Mood Check-in</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Switcher */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "light" | "deep")}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1.5 backdrop-blur-sm">
              <TabsTrigger 
                value="light" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 rounded-lg transition-all duration-300"
              >
                Light Mode
              </TabsTrigger>
              <TabsTrigger 
                value="deep" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 rounded-lg transition-all duration-300"
              >
                Deep Mode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="light" className="mt-6">
              <MoodCheckInLight onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
            </TabsContent>

            <TabsContent value="deep" className="mt-6">
              <MoodCheckInDeep onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>

          {/* Today's Logs */}
          {todayLogs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-300">Today&apos;s Check-ins</h3>
              </div>
              <div className="space-y-2">
                {todayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {log.moodEmoji && <span className="text-2xl">{log.moodEmoji}</span>}
                      <div>
                        <p className="text-sm text-white">
                          {log.moodEmoji || "Detailed mood"}
                          {log.descriptor && ` • ${log.descriptor}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(log.loggedAt), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

