"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { activityStatusService, STATUS_CONFIG, type ActivityStatus } from "@/src/shared/services/activity-status.service";
import { toast } from "react-hot-toast";

interface StatusPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  initialStatus?: ActivityStatus;
  initialMood?: number;
  initialNotes?: string;
  onSuccess?: () => void;
}

const MOOD_EMOJIS = ["😞", "😐", "😊", "😄", "🌟"];

export function StatusPickerModal({
  open,
  onOpenChange,
  date,
  initialStatus,
  initialMood,
  initialNotes,
  onSuccess,
}: StatusPickerModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ActivityStatus>(initialStatus || "working");
  const [mood, setMood] = useState<number>(initialMood || 3);
  const [notes, setNotes] = useState<string>(initialNotes || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await activityStatusService.setStatusForDate({
        date,
        status: selectedStatus,
        mood,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        toast.success("Status updated successfully!");
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Activity Status</DialogTitle>
          <DialogDescription>
            {new Date(date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Select Status</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <motion.button
                  key={status}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStatus(status as ActivityStatus)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedStatus === status
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                  }`}
                  style={{
                    backgroundColor: selectedStatus === status ? `${config.color}15` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{config.icon}</span>
                    <div>
                      <div className="font-semibold text-sm capitalize">{status}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Mood Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Mood (Optional)</Label>
            <div className="flex items-center gap-4">
              {MOOD_EMOJIS.map((emoji, index) => {
                const moodValue = index + 1;
                return (
                  <motion.button
                    key={moodValue}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMood(moodValue)}
                    className={`text-4xl transition-all ${
                      mood === moodValue
                        ? "scale-125 filter drop-shadow-lg"
                        : "opacity-50 hover:opacity-75"
                    }`}
                  >
                    {emoji}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selected: {mood}/5
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-semibold mb-2 block">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about your day..."
              className="min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {notes.length}/1000 characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-gradient-to-r from-primary to-purple-500"
            >
              {isLoading ? "Saving..." : "Save Status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

