"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StressCheckInLight } from "./StressCheckInLight";
import { StressCheckInDeep } from "./StressCheckInDeep";
import { stressService, type StressLog, type CheckInType } from "@/src/shared/services/stress.service";
import { Clock } from "lucide-react";
import { format } from "date-fns";

interface StressCheckInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInType?: CheckInType;
  initialMode?: 'light' | 'deep';
}

export function StressCheckIn({
  open,
  onOpenChange,
  checkInType = 'on_demand',
  initialMode = 'light',
}: StressCheckInProps) {
  const [mode, setMode] = useState<'light' | 'deep'>(initialMode);
  const [todayLogs, setTodayLogs] = useState<StressLog[]>([]);
  const [_isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Load today's logs when dialog opens
  useEffect(() => {
    if (open) {
      loadTodayLogs();
      
      // Emit analytics event
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'stress_checkin_opened', {
          mode,
          type: checkInType,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, checkInType]);

  const loadTodayLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const result = await stressService.getTodayLogs();
      if (result.success && result.data) {
        setTodayLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to load today\'s logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSuccess = () => {
    // Reload today's logs
    loadTodayLogs();
    
    // Close the modal after successful submission
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Stress Check-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Switcher */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'light' | 'deep')}>
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger value="light" className="data-[state=active]:bg-purple-600">
                Light Mode
              </TabsTrigger>
              <TabsTrigger value="deep" className="data-[state=active]:bg-purple-600">
                Deep Mode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="light" className="mt-6">
              <StressCheckInLight
                checkInType={checkInType}
                onSuccess={handleSuccess}
                onCancel={handleClose}
              />
            </TabsContent>

            <TabsContent value="deep" className="mt-6">
              <StressCheckInDeep
                checkInType={checkInType}
                onSuccess={handleSuccess}
                onCancel={handleClose}
              />
            </TabsContent>
          </Tabs>

          {/* Today's Logs */}
          {todayLogs.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Today&apos;s Logs ({todayLogs.length})
              </h3>
              <div className="space-y-3">
                <AnimatePresence>
                  {todayLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`text-2xl font-bold ${stressService.getStressRatingColor(
                                log.stressRating
                              )}`}
                            >
                              {log.stressRating}
                            </span>
                            <span className="text-sm text-slate-400">
                              {stressService.getStressRatingLabel(log.stressRating)}
                            </span>
                            <span className="text-xs text-slate-500 px-2 py-1 rounded bg-white/5">
                              {log.checkInType === 'daily' ? 'Daily' : 'On-demand'}
                            </span>
                          </div>
                          {log.triggers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {log.triggers.map((trigger) => (
                                <span
                                  key={trigger}
                                  className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300"
                                >
                                  {trigger}
                                </span>
                              ))}
                            </div>
                          )}
                          {log.note && (
                            <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                              {log.note}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(log.loggedAt), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

