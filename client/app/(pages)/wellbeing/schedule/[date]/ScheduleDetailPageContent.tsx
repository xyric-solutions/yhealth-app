"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Link2,
  Zap,
  LayoutGrid,
  Clock,
  GitBranch,
  MousePointerClick,
  Workflow,
  ChevronDown,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { format, parseISO, isToday } from "date-fns";
import { DashboardLayout } from "@/components/layout";
import {
  scheduleService,
  type DailySchedule,
  type ScheduleItem,
  type ScheduleLink,
} from "@/src/shared/services/schedule.service";
import { ActivityFormModal } from "@/app/(pages)/dashboard/components/wellbeing/schedule/ActivityFormModal";
import { ConfirmModal } from "@/app/(pages)/dashboard/components/wellbeing/schedule/ConfirmModal";
import { AlertModal } from "@/app/(pages)/dashboard/components/wellbeing/schedule/AlertModal";
import ScheduleWorkflow from "@/app/(pages)/dashboard/components/wellbeing/schedule/ScheduleWorkflow";
import { ApiError } from "@/lib/api-client";

/* ─────────────────────── Loading ─────────────────────── */

function ScheduleDetailLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="text-center space-y-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mx-auto relative" />
        </div>
        <p className="text-slate-500 text-sm font-medium tracking-wide">
          Loading workflow...
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── Helpers ─────────────────────── */

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getEndTime = (item: ScheduleItem): number => {
  const startMinutes = timeToMinutes(item.startTime);
  if (item.endTime) return timeToMinutes(item.endTime);
  if (item.durationMinutes) return startMinutes + item.durationMinutes;
  return startMinutes + 30;
};

/* ─────────────────────── Main Content ─────────────────────── */

function ScheduleDetailContent() {
  const router = useRouter();
  const params = useParams();
  const dateParam = params.date as string;

  // Core state
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSource, setLinkSource] = useState<ScheduleItem | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemPositions, setItemPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const itemsRef = useRef<ScheduleItem[]>([]);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info" | "success";
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: "success" | "info" | "warning";
  }>({ isOpen: false, title: "", message: "" });

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      variant: "danger" | "warning" | "info" | "success" = "danger"
    ) => {
      setConfirmModal({ isOpen: true, title, message, onConfirm, variant });
    },
    []
  );

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      variant: "success" | "info" | "warning" = "info"
    ) => {
      setAlertModal({ isOpen: true, title, message, variant });
    },
    []
  );

  // Parse date
  let scheduleDate: string;
  try {
    const parsedDate = parseISO(dateParam);
    scheduleDate = format(parsedDate, "yyyy-MM-dd");
  } catch {
    scheduleDate = format(new Date(), "yyyy-MM-dd");
  }

  const parsedScheduleDate = parseISO(scheduleDate);
  const dayName = format(parsedScheduleDate, "EEEE");
  const monthDay = format(parsedScheduleDate, "MMM d, yyyy");
  const isTodayDate = isToday(parsedScheduleDate);

  /* ─────────── Data Loading ─────────── */

  useEffect(() => {
    loadSchedule(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate]);

  const loadSchedule = async (forceFresh = false) => {
    setIsLoading(true);
    try {
      const dateStr = forceFresh
        ? `${scheduleDate}?_t=${Date.now()}`
        : scheduleDate;
      const result = await scheduleService.getScheduleByDate(dateStr);
      if (result.success && result.data) {
        setSchedule(result.data.schedule);
        if (result.data.schedule) {
          itemsRef.current = result.data.schedule.items;
          const positions: Record<string, { x: number; y: number }> = {};
          result.data.schedule.items.forEach((item) => {
            const metadata = item.metadata as
              | { x?: number; y?: number }
              | undefined;
            if (
              metadata &&
              typeof metadata.x === "number" &&
              typeof metadata.y === "number"
            ) {
              positions[item.id] = { x: metadata.x, y: metadata.y };
            }
          });
          setItemPositions(positions);
        }
      } else {
        setSchedule(null);
        itemsRef.current = [];
        setItemPositions({});
      }
    } catch (err) {
      console.error("Failed to load schedule:", err);
      setSchedule(null);
      itemsRef.current = [];
      setItemPositions({});
    } finally {
      setIsLoading(false);
    }
  };

  /* ─────────── CRUD Handlers ─────────── */

  const handleCreateSchedule = async () => {
    try {
      const existingResult =
        await scheduleService.getScheduleByDate(scheduleDate);
      if (existingResult.success && existingResult.data?.schedule) {
        setSchedule(existingResult.data.schedule);
        itemsRef.current = existingResult.data.schedule.items;
        return;
      }
      const result = await scheduleService.createSchedule({
        schedule_date: scheduleDate,
      });
      if (result.success && result.data) {
        setSchedule(result.data.schedule);
        itemsRef.current = result.data.schedule.items;
      }
    } catch (err: unknown) {
      console.error("Failed to create schedule:", err);
      const errorMessage =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : String(err);
      if (
        errorMessage.includes("already exists") ||
        errorMessage.includes("Schedule already exists")
      ) {
        try {
          const existingResult =
            await scheduleService.getScheduleByDate(scheduleDate);
          if (existingResult.success && existingResult.data?.schedule) {
            setSchedule(existingResult.data.schedule);
            itemsRef.current = existingResult.data.schedule.items;
          }
        } catch (loadErr) {
          console.error("Failed to load existing schedule:", loadErr);
        }
      }
    }
  };

  const handleAddItem = async () => {
    if (!schedule) {
      await handleCreateSchedule();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await loadSchedule();
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = Math.floor(now.getMinutes() / 30) * 30;

    try {
      const result = await scheduleService.addScheduleItem(schedule.id, {
        title: "New Activity",
        start_time: `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`,
        duration_minutes: 30,
        position: schedule.items.length,
        metadata: { x: 100, y: 100 },
      });

      if (result.success && result.data?.item) {
        const newItem = result.data.item;
        setSchedule((prev) => {
          if (!prev) return null;
          return { ...prev, items: [...prev.items, newItem] };
        });
        itemsRef.current = [...itemsRef.current, newItem];
        const metadata = newItem.metadata as
          | { x?: number; y?: number }
          | undefined;
        if (
          metadata &&
          typeof metadata.x === "number" &&
          typeof metadata.y === "number"
        ) {
          setItemPositions((prev) => ({
            ...prev,
            [newItem.id]: { x: metadata.x!, y: metadata.y! },
          }));
        }
      }
    } catch (err) {
      console.error("Failed to add item:", err);
    }
  };

  const handleEditItem = (item: ScheduleItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = (item: ScheduleItem) => {
    showConfirm(
      "Delete Activity",
      `Are you sure you want to delete "${item.title}"? This will also remove all connections to this activity.`,
      async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await scheduleService.deleteScheduleItem(item.id);
          if (result.success) {
            setSchedule((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                items: prev.items.filter((i) => i.id !== item.id),
                links: prev.links.filter(
                  (link) =>
                    link.sourceItemId !== item.id &&
                    link.targetItemId !== item.id
                ),
              };
            });
            itemsRef.current = itemsRef.current.filter(
              (i) => i.id !== item.id
            );
            setItemPositions((prev) => {
              const updated = { ...prev };
              delete updated[item.id];
              return updated;
            });
            showAlert("Success", "Activity deleted successfully", "success");
          } else {
            showAlert(
              "Error",
              "Failed to delete activity. Please try again.",
              "warning"
            );
          }
        } catch (err) {
          console.error("Failed to delete item:", err);
          showAlert(
            "Error",
            "Failed to delete activity. Please try again.",
            "warning"
          );
        }
      },
      "danger"
    );
  };

  /* ─────────── Position & Connection Handlers ─────────── */

  const handlePositionChange = useCallback(
    async (itemId: string, position: { x: number; y: number }) => {
      if (!schedule) return;
      const item = schedule.items.find((i) => i.id === itemId);
      if (!item) return;

      const newX = Math.max(0, position.x);
      const newY = Math.max(0, position.y);

      setItemPositions((prev) => ({
        ...prev,
        [itemId]: { x: newX, y: newY },
      }));

      try {
        const existingMetadata =
          (item.metadata as Record<string, unknown>) || {};
        const updatedMetadata = { ...existingMetadata, x: newX, y: newY };

        const result = await scheduleService.updateScheduleItem(itemId, {
          metadata: updatedMetadata,
        });

        if (result.success && result.data?.item) {
          setSchedule((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId ? result.data!.item : i
              ),
            };
          });
        }
      } catch (err) {
        console.error("Failed to update position:", err);
        setItemPositions((prev) => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule, itemPositions]
  );

  const generateTimeBasedConnections = () => {
    if (!schedule || schedule.items.length < 2) return;

    const newLinks: Array<{
      sourceId: string;
      targetId: string;
      delay: number;
    }> = [];

    schedule.items.forEach((sourceItem) => {
      const sourceEnd = getEndTime(sourceItem);
      schedule.items.forEach((targetItem) => {
        if (sourceItem.id === targetItem.id) return;
        const targetStart = timeToMinutes(targetItem.startTime);
        const timeGap = targetStart - sourceEnd;

        if (timeGap >= 0 && timeGap <= 30) {
          const linkExists = schedule.links.some(
            (l) =>
              (l.sourceItemId === sourceItem.id &&
                l.targetItemId === targetItem.id) ||
              (l.sourceItemId === targetItem.id &&
                l.targetItemId === sourceItem.id)
          );
          if (!linkExists) {
            newLinks.push({
              sourceId: sourceItem.id,
              targetId: targetItem.id,
              delay: timeGap,
            });
          }
        }
      });
    });

    return newLinks;
  };

  const handleAutoConnect = async () => {
    if (!schedule || schedule.items.length < 2) {
      showAlert(
        "Not Enough Activities",
        "You need at least 2 activities to auto-connect.",
        "warning"
      );
      return;
    }

    const timeConnections = generateTimeBasedConnections();
    if (!timeConnections || timeConnections.length === 0) {
      showAlert(
        "No Connections Found",
        "No time-based connections found. Activities may not be sequential.",
        "info"
      );
      return;
    }

    try {
      const linkPromises = timeConnections.map((conn) =>
        scheduleService.createScheduleLink(schedule.id, {
          source_item_id: conn.sourceId,
          target_item_id: conn.targetId,
          link_type: "sequential",
          delay_minutes: conn.delay,
        })
      );

      const results = await Promise.all(linkPromises);
      const successfulLinks = results
        .filter((r) => r.success && r.data?.link)
        .map((r) => r.data!.link);

      if (successfulLinks.length > 0) {
        setSchedule((prev) => {
          if (!prev) return null;
          return { ...prev, links: [...prev.links, ...successfulLinks] };
        });
        showAlert(
          "Success",
          `Created ${successfulLinks.length} connection(s)!`,
          "success"
        );
      }
    } catch (err) {
      console.error("Failed to create time connections:", err);
      showAlert(
        "Error",
        "Failed to create some connections.",
        "warning"
      );
    }
  };

  /* ─────────── Loading State ─────────── */

  if (isLoading) {
    return <ScheduleDetailLoading />;
  }

  const itemCount = schedule?.items.length ?? 0;
  const linkCount = schedule?.links.length ?? 0;

  /* ─────────── Render ─────────── */

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0d0d14] overflow-hidden">
        {/* ══════════ Top Toolbar ══════════ */}
        <div className="flex-shrink-0 h-12 border-b border-white/[0.06] bg-[#0d0d14]/95 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 z-20">
          {/* Left: Back + Date */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push("/wellbeing/schedule")}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Back to Calendar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="hidden sm:block w-px h-5 bg-white/[0.06]" />

            <div className="flex items-center gap-2 min-w-0">
              <Workflow className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-sm font-semibold text-white truncate">
                  {dayName}
                </h1>
                <span className="text-slate-500 text-sm hidden sm:inline">
                  {monthDay}
                </span>
                {isTodayDate && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Today
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Stats (desktop only) */}
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>
                {itemCount} {itemCount === 1 ? "activity" : "activities"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span>
                {linkCount} {linkCount === 1 ? "connection" : "connections"}
              </span>
            </div>
            {schedule && itemCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.round(
                    schedule.items.reduce(
                      (sum, i) => sum + (i.durationMinutes || 30),
                      0
                    ) / 60
                  )}
                  h total
                </span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={handleAutoConnect}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                title="Auto-connect activities by time"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Auto-Connect</span>
              </button>

              <button
                onClick={() => {
                  if (isLinking) {
                    setIsLinking(false);
                    setLinkSource(null);
                  } else {
                    if (schedule && schedule.items.length < 2) {
                      showAlert(
                        "Not Enough Activities",
                        "You need at least 2 activities to create a link.",
                        "warning"
                      );
                      return;
                    }
                    setIsLinking(true);
                  }
                }}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                  isLinking
                    ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]"
                }`}
                title={isLinking ? "Cancel linking" : "Manual link mode"}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">
                  {isLinking ? "Cancel" : "Link"}
                </span>
              </button>
            </div>

            <div className="hidden sm:block w-px h-5 bg-white/[0.06]" />

            {/* Add Activity - always visible */}
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Activity</span>
            </button>

            {/* Mobile: overflow menu */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showActionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowActionsMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-[#1a1a24] border border-white/[0.08] shadow-xl z-40 py-1">
                    <button
                      onClick={() => {
                        handleAutoConnect();
                        setShowActionsMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Auto-Connect
                    </button>
                    <button
                      onClick={() => {
                        if (isLinking) {
                          setIsLinking(false);
                          setLinkSource(null);
                        } else {
                          setIsLinking(true);
                        }
                        setShowActionsMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {isLinking ? "Cancel Linking" : "Manual Link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ Link Mode Banner ══════════ */}
        {isLinking && (
          <div className="flex-shrink-0 h-8 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-center gap-2 px-4 z-10">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-300">
              {linkSource
                ? `Now click the target activity to connect from "${linkSource.title}"`
                : "Click the source activity to start linking"}
            </span>
            <button
              onClick={() => {
                setIsLinking(false);
                setLinkSource(null);
              }}
              className="ml-2 text-xs text-emerald-400/70 hover:text-emerald-300 underline transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ══════════ Canvas Area ══════════ */}
        <div className="flex-1 relative min-h-0">
          {!schedule || schedule.items.length === 0 ? (
            /* ── Empty State ── */
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Subtle grid background */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}
              />

              <div className="relative text-center max-w-sm mx-auto px-6">
                {/* Icon */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 rotate-6" />
                  <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 -rotate-3" />
                  <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/20">
                    <Workflow className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">
                  Start Building Your Day
                </h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Create activities and connect them to visualize your daily
                  schedule as a workflow.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
                  <button
                    onClick={handleCreateSchedule}
                    className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    Create Schedule
                  </button>
                  <button
                    onClick={() => router.push("/wellbeing/schedule")}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                  >
                    Back to Calendar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Workflow Canvas ── */
            <ScheduleWorkflow
              schedule={schedule}
              onNodeEdit={handleEditItem}
              onNodeDelete={handleDeleteItem}
              onNodeCreate={async (position: { x: number; y: number }) => {
                if (!schedule) {
                  await handleCreateSchedule();
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  await loadSchedule();
                  return;
                }

                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute =
                  Math.floor(now.getMinutes() / 30) * 30;

                try {
                  const result = await scheduleService.addScheduleItem(
                    schedule.id,
                    {
                      title: "New Activity",
                      start_time: `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`,
                      duration_minutes: 30,
                      position: schedule.items.length,
                      metadata: { x: position.x, y: position.y },
                    }
                  );

                  if (result.success && result.data) {
                    setSchedule((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        items: [...prev.items, result.data!.item],
                      };
                    });
                    itemsRef.current = [
                      ...itemsRef.current,
                      result.data!.item,
                    ];
                    const metadata = result.data.item.metadata as
                      | { x?: number; y?: number }
                      | undefined;
                    if (
                      metadata &&
                      typeof metadata.x === "number" &&
                      typeof metadata.y === "number"
                    ) {
                      setItemPositions((prev) => ({
                        ...prev,
                        [result.data!.item.id]: {
                          x: metadata.x!,
                          y: metadata.y!,
                        },
                      }));
                    }
                  }
                } catch (err) {
                  console.error("Failed to create item:", err);
                  showAlert(
                    "Error",
                    "Failed to create activity. Please try again.",
                    "warning"
                  );
                }
              }}
              onNodePositionChange={handlePositionChange}
              onEdgeCreate={async (
                sourceId: string,
                targetId: string
              ) => {
                if (!schedule) return;

                const linkExists = schedule.links.some(
                  (l) =>
                    (l.sourceItemId === sourceId &&
                      l.targetItemId === targetId) ||
                    (l.sourceItemId === targetId &&
                      l.targetItemId === sourceId)
                );

                if (linkExists) {
                  showAlert(
                    "Link Exists",
                    "A link already exists between these activities.",
                    "info"
                  );
                  return;
                }

                try {
                  const result = await scheduleService.createScheduleLink(
                    schedule.id,
                    {
                      source_item_id: sourceId,
                      target_item_id: targetId,
                      link_type: "sequential",
                    }
                  );

                  if (result.success && result.data) {
                    setSchedule((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        links: [...prev.links, result.data!.link],
                      };
                    });
                  }
                } catch (err) {
                  console.error("Failed to create link:", err);
                  showAlert(
                    "Error",
                    "Failed to create connection. Please try again.",
                    "warning"
                  );
                }
              }}
              onEdgeDelete={async (linkId: string) => {
                if (!schedule) return;
                const link = schedule.links.find((l) => l.id === linkId);
                if (!link) return;

                const sourceItem = schedule.items.find(
                  (i) => i.id === link.sourceItemId
                );
                const targetItem = schedule.items.find(
                  (i) => i.id === link.targetItemId
                );

                showConfirm(
                  "Delete Connection",
                  `Delete the connection between "${sourceItem?.title || "Activity"}" and "${targetItem?.title || "Activity"}"?`,
                  async () => {
                    setConfirmModal((prev) => ({
                      ...prev,
                      isOpen: false,
                    }));
                    try {
                      const result =
                        await scheduleService.deleteScheduleLink(linkId);
                      if (result.success) {
                        setSchedule((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            links: prev.links.filter(
                              (l) => l.id !== linkId
                            ),
                          };
                        });
                        showAlert(
                          "Connection Deleted",
                          "The connection has been removed.",
                          "success"
                        );
                      } else {
                        showAlert(
                          "Error",
                          "Failed to delete connection.",
                          "warning"
                        );
                      }
                    } catch (err) {
                      console.error("Failed to delete link:", err);
                      showAlert(
                        "Error",
                        "Failed to delete connection.",
                        "warning"
                      );
                    }
                  },
                  "danger"
                );
              }}
              onAutoConnect={async () => {
                if (!schedule || schedule.items.length < 2) return;
                const timeConnections = generateTimeBasedConnections();
                if (!timeConnections || timeConnections.length === 0) return;

                try {
                  const linkPromises = timeConnections.map((conn) =>
                    scheduleService.createScheduleLink(schedule.id, {
                      source_item_id: conn.sourceId,
                      target_item_id: conn.targetId,
                      link_type: "sequential",
                      delay_minutes: conn.delay,
                    })
                  );

                  const results = await Promise.all(linkPromises);
                  const successfulLinks = results
                    .filter((r) => r.success && r.data?.link)
                    .map((r) => r.data!.link);

                  if (successfulLinks.length > 0) {
                    setSchedule((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        links: [...prev.links, ...successfulLinks],
                      };
                    });
                  }
                } catch (err) {
                  console.error("Failed to create time connections:", err);
                }
              }}
            />
          )}
        </div>

        {/* ══════════ Bottom Status Bar (mobile stats) ══════════ */}
        {schedule && itemCount > 0 && (
          <div className="flex-shrink-0 h-7 border-t border-white/[0.06] bg-[#0d0d14]/95 flex items-center justify-between px-3 md:hidden z-10">
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span>{itemCount} activities</span>
              <span>{linkCount} connections</span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ Modals ══════════ */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        activity={editingItem}
        onSave={(updatedItem) => {
          if (updatedItem) {
            if (editingItem) {
              setSchedule((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  items: prev.items.map((item) =>
                    item.id === updatedItem.id ? updatedItem : item
                  ),
                };
              });
              itemsRef.current = itemsRef.current.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
              );
              const metadata = updatedItem.metadata as
                | { x?: number; y?: number }
                | undefined;
              if (
                metadata &&
                typeof metadata.x === "number" &&
                typeof metadata.y === "number"
              ) {
                setItemPositions((prev) => ({
                  ...prev,
                  [updatedItem.id]: { x: metadata.x!, y: metadata.y! },
                }));
              }
            } else {
              setSchedule((prev) => {
                if (!prev) return null;
                return { ...prev, items: [...prev.items, updatedItem] };
              });
              itemsRef.current = [...itemsRef.current, updatedItem];
              const metadata = updatedItem.metadata as
                | { x?: number; y?: number }
                | undefined;
              if (
                metadata &&
                typeof metadata.x === "number" &&
                typeof metadata.y === "number"
              ) {
                setItemPositions((prev) => ({
                  ...prev,
                  [updatedItem.id]: { x: metadata.x!, y: metadata.y! },
                }));
              }
            }
          } else {
            loadSchedule();
          }
        }}
        scheduleId={schedule?.id}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={
          confirmModal.variant === "danger" ? "Delete" : "Confirm"
        }
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() =>
          setAlertModal((prev) => ({ ...prev, isOpen: false }))
        }
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </DashboardLayout>
  );
}

export default function ScheduleDetailPageContent() {
  return (
    <Suspense fallback={<ScheduleDetailLoading />}>
      <ScheduleDetailContent />
    </Suspense>
  );
}
