/**
 * @file ScheduleItem Component
 * @description Draggable and resizable schedule item with edit capabilities
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Edit2, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scheduleService, type ScheduleItem as ScheduleItemType } from "@/src/shared/services/schedule.service";
import { format } from "date-fns";

interface ScheduleItemProps {
  item: ScheduleItemType;
  onUpdate: (item: ScheduleItemType) => void;
  onDelete: (itemId: string) => void;
  onEdit: (item: ScheduleItemType) => void;
  timelineHeight: number; // Height of timeline in pixels
  startHour?: number;
}

export function ScheduleItem({
  item,
  onUpdate,
  onDelete,
  onEdit,
  timelineHeight,
  startHour = 0,
}: ScheduleItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [_isResizing, setIsResizing] = useState(false);

  // Calculate position and height based on time
  const timeToPosition = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = (hours - startHour) * 60 + minutes;
    return (totalMinutes / ((24 - startHour) * 60)) * timelineHeight;
  };

  const position = timeToPosition(item.startTime);
  const duration = item.durationMinutes || 30;
  const height = (duration / ((24 - startHour) * 60)) * timelineHeight;

  const handleResize = async (newHeight: number) => {
    const newDuration = Math.round((newHeight / timelineHeight) * ((24 - startHour) * 60));
    const minDuration = 15;
    const maxDuration = 24 * 60;

    if (newDuration >= minDuration && newDuration <= maxDuration) {
      try {
        const result = await scheduleService.updateScheduleItem(item.id, {
          duration_minutes: newDuration,
        });

        if (result.success && result.data) {
          onUpdate(result.data.item);
        }
      } catch (err) {
        console.error("Failed to update item duration:", err);
      }
    }
  };

  return (
    <motion.div
      className="absolute left-0 right-0 group"
      style={{
        top: `${position}px`,
        height: `${height}px`,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <div
        className={`relative h-full rounded-lg border-2 transition-all ${
          item.color
            ? `bg-${item.color}/20 border-${item.color}/50`
            : "bg-emerald-500/20 border-emerald-500/50"
        } ${isHovered ? "shadow-lg shadow-emerald-500/30" : ""}`}
        style={{
          backgroundColor: item.color ? `${item.color}20` : "rgba(16, 185, 129, 0.2)",
          borderColor: item.color ? `${item.color}80` : "rgba(16, 185, 129, 0.5)",
        }}
      >
        {/* Drag handle */}
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-move hover:bg-emerald-500/30 rounded-l-lg transition-colors flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Content */}
        <div className="pl-3 pr-2 py-1 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.icon && <span className="text-sm">{item.icon}</span>}
                <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
              </div>
              {item.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(item)}
                className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-400"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id)}
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {format(new Date(`2000-01-01T${item.startTime}`), "h:mm a")}
              {item.endTime && ` - ${format(new Date(`2000-01-01T${item.endTime}`), "h:mm a")}`}
            </span>
            {item.durationMinutes && (
              <span>{Math.round(item.durationMinutes / 60 * 10) / 10}h</span>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-emerald-500/30 rounded-b-lg transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            const startY = e.clientY;
            const startHeight = height;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = moveEvent.clientY - startY;
              const newHeight = Math.max(20, startHeight + deltaY);
              handleResize(newHeight);
            };

            const handleMouseUp = () => {
              setIsResizing(false);
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        />
      </div>
    </motion.div>
  );
}


