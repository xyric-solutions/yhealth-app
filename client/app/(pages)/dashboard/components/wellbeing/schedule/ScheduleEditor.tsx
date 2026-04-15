/**
 * @file ScheduleEditor Component
 * @description Main editor with timeline, drag-drop items, and linking
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeLine } from "./TimeLine";
import { ScheduleItem } from "./ScheduleItem";
import { ScheduleLink } from "./ScheduleLink";
import { scheduleService, type DailySchedule, type ScheduleItem as ScheduleItemType, type ScheduleLink as _ScheduleLinkType } from "@/src/shared/services/schedule.service";

interface ScheduleEditorProps {
  scheduleDate: string;
  schedule?: DailySchedule | null;
  onScheduleChange?: (schedule: DailySchedule) => void;
}

const TIMELINE_HEIGHT = 1440; // 24 hours * 60 minutes

export function ScheduleEditor({ scheduleDate, schedule: initialSchedule, onScheduleChange }: ScheduleEditorProps) {
  const [schedule, setSchedule] = useState<DailySchedule | null>(initialSchedule || null);
  const [isLoading, setIsLoading] = useState(!initialSchedule);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSource, setLinkSource] = useState<ScheduleItemType | null>(null);
  const [_editingItem, setEditingItem] = useState<ScheduleItemType | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialSchedule) {
      loadSchedule();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate, initialSchedule]);

  const loadSchedule = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await scheduleService.getScheduleByDate(scheduleDate);

      if (result.success && result.data) {
        setSchedule(result.data.schedule);
      } else {
        setError(result.error?.message || "Failed to load schedule");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const result = await scheduleService.createSchedule({
        schedule_date: scheduleDate,
      });

      if (result.success && result.data) {
        setSchedule(result.data.schedule);
        if (onScheduleChange) {
          onScheduleChange(result.data.schedule);
        }
      } else {
        setError(result.error?.message || "Failed to create schedule");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!schedule) {
      await handleCreateSchedule();
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = Math.floor(now.getMinutes() / 30) * 30; // Round to nearest 30 minutes

    const newItem: Partial<ScheduleItemType> = {
      title: "New Activity",
      startTime: `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`,
      durationMinutes: 30,
      position: schedule.items.length,
    };

    try {
      const result = await scheduleService.addScheduleItem(schedule.id, {
        title: newItem.title!,
        start_time: newItem.startTime!,
        duration_minutes: newItem.durationMinutes,
        position: newItem.position!,
      });

      if (result.success && result.data) {
        const updatedSchedule = {
          ...schedule,
          items: [...schedule.items, result.data.item],
        };
        setSchedule(updatedSchedule);
        if (onScheduleChange) {
          onScheduleChange(updatedSchedule);
        }
        setEditingItem(result.data.item);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handleUpdateItem = async (item: ScheduleItemType) => {
    if (!schedule) return;

    try {
      const result = await scheduleService.updateScheduleItem(item.id, {
        title: item.title,
        description: item.description,
        start_time: item.startTime,
        end_time: item.endTime,
        duration_minutes: item.durationMinutes,
        color: item.color,
        icon: item.icon,
        category: item.category,
        position: item.position,
        metadata: item.metadata,
      });

      if (result.success && result.data) {
        const updatedSchedule = {
          ...schedule,
          items: schedule.items.map((i) => (i.id === item.id && result.data?.item ? result.data.item : i)),
        };
        setSchedule(updatedSchedule);
        if (onScheduleChange) {
          onScheduleChange(updatedSchedule);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!schedule) return;

    try {
      await scheduleService.deleteScheduleItem(itemId);

      const updatedSchedule = {
        ...schedule,
        items: schedule.items.filter((i) => i.id !== itemId),
        links: schedule.links.filter(
          (l) => l.sourceItemId !== itemId && l.targetItemId !== itemId
        ),
      };
      setSchedule(updatedSchedule);
      if (onScheduleChange) {
        onScheduleChange(updatedSchedule);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const _handleStartLinking = (item: ScheduleItemType) => {
    setIsLinking(true);
    setLinkSource(item);
  };

  const handleCreateLink = async (targetItem: ScheduleItemType) => {
    if (!schedule || !linkSource) return;

    if (linkSource.id === targetItem.id) {
      setIsLinking(false);
      setLinkSource(null);
      return;
    }

    try {
      const result = await scheduleService.createScheduleLink(schedule.id, {
        source_item_id: linkSource.id,
        target_item_id: targetItem.id,
        link_type: "sequential",
      });

      if (result.success && result.data) {
        const updatedSchedule = {
          ...schedule,
          links: [...schedule.links, result.data.link],
        };
        setSchedule(updatedSchedule);
        if (onScheduleChange) {
          onScheduleChange(updatedSchedule);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setIsLinking(false);
      setLinkSource(null);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!schedule) return;

    try {
      await scheduleService.deleteScheduleLink(linkId);

      const updatedSchedule = {
        ...schedule,
        links: schedule.links.filter((l) => l.id !== linkId),
      };
      setSchedule(updatedSchedule);
      if (onScheduleChange) {
        onScheduleChange(updatedSchedule);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete link");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error && !schedule) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        {error}
        <Button onClick={handleCreateSchedule} className="mt-2" size="sm">
          Create Schedule
        </Button>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">No schedule for this date</p>
        <Button onClick={handleCreateSchedule} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAddItem}
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </Button>
          <Button
            onClick={() => setIsLinking(!isLinking)}
            size="sm"
            variant={isLinking ? "default" : "outline"}
            className={isLinking ? "bg-emerald-600 text-white" : ""}
          >
            <Link2 className="w-4 h-4 mr-2" />
            {isLinking ? "Cancel Linking" : "Link Items"}
          </Button>
        </div>
        {isLinking && linkSource && (
          <div className="text-sm text-emerald-400">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Click on an item to link from "{linkSource.title}"
          </div>
        )}
      </div>

      {/* Timeline with items */}
      <div className="relative rounded-xl border border-emerald-500/20 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <div
          ref={timelineRef}
          className="relative"
          style={{ height: `${TIMELINE_HEIGHT}px`, minHeight: `${TIMELINE_HEIGHT}px` }}
        >
          {/* Timeline background */}
          <TimeLine />

          {/* SVG overlay for links */}
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            style={{ width: "100%", height: "100%" }}
          >
            {schedule.links.map((link) => {
              const sourceItem = schedule.items.find((i) => i.id === link.sourceItemId);
              const targetItem = schedule.items.find((i) => i.id === link.targetItemId);
              if (!sourceItem || !targetItem) return null;

              return (
                <ScheduleLink
                  key={link.id}
                  link={link}
                  sourceItem={sourceItem}
                  targetItem={targetItem}
                  onDelete={handleDeleteLink}
                  timelineHeight={TIMELINE_HEIGHT}
                />
              );
            })}
          </svg>

          {/* Schedule items */}
          {schedule.items.map((item) => (
            <ScheduleItem
              key={item.id}
              item={item}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
              onEdit={setEditingItem}
              timelineHeight={TIMELINE_HEIGHT}
            />
          ))}

          {/* Link creation overlay */}
          {isLinking && linkSource && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair"
              onClick={() => {
                setIsLinking(false);
                setLinkSource(null);
              }}
            >
              {schedule.items.map((item) => (
                <div
                  key={item.id}
                  className="absolute left-0 right-0 border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 rounded-lg cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  style={{
                    top: `${((parseInt(item.startTime.split(":")[0]) * 60 + parseInt(item.startTime.split(":")[1])) / (24 * 60)) * TIMELINE_HEIGHT}px`,
                    height: `${((item.durationMinutes || 30) / (24 * 60)) * TIMELINE_HEIGHT}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateLink(item);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}


