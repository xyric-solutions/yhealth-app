"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activityStatusService, STATUS_CONFIG, type CalendarDayStatus } from "@/src/shared/services/activity-status.service";
import { StatusPickerModal } from "./StatusPickerModal";
import { toast } from "react-hot-toast";

interface StatusCalendarProps {
  onDateSelect?: (date: string) => void;
}

export function StatusCalendar({ onDateSelect }: StatusCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDayStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    loadCalendarData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const response = await activityStatusService.getCalendar(year, month);
      if (response.success && response.data) {
        setCalendarData(response.data.days);
      }
    } catch (_error) {
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: CalendarDayStatus) => {
    setSelectedDate(day.date);
    setIsPickerOpen(true);
    onDateSelect?.(day.date);
  };

  const handleStatusUpdate = () => {
    loadCalendarData();
  };

  // Get first day of month and number of days
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Generate calendar grid
  const calendarDays: (CalendarDayStatus | null)[] = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    // Use Date object to ensure correct date formatting and avoid timezone issues
    const dateObj = new Date(year, month - 1, day);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
    const dayData = calendarData.find((d) => d.date === dateStr) || { date: dateStr };
    calendarDays.push(dayData);
  }

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() + 1 &&
      year === today.getFullYear()
    );
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {monthName}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={goToToday} className="rounded-full">
          Today
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayNumber = parseInt(day.date.split("-")[2]);
              const config = day.status ? STATUS_CONFIG[day.status] : null;
              const todayClass = isToday(dayNumber) ? "ring-2 ring-primary" : "";

              return (
                <motion.button
                  key={day.date}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-lg border-2 transition-all relative overflow-hidden ${todayClass} ${
                    config
                      ? "border-transparent"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                  }`}
                  style={{
                    backgroundColor: config ? `${config.color}15` : undefined,
                  }}
                >
                  <div className="flex flex-col items-center justify-center h-full p-1">
                    <span
                      className={`text-sm font-semibold ${
                        isToday(dayNumber) ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {config && (
                      <span className="text-lg leading-none">{config.icon}</span>
                    )}
                    {day.mood && (
                      <span className="text-xs leading-none mt-0.5">
                        {["😞", "😐", "😊", "😄", "🌟"][day.mood - 1]}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div
            key={status}
            className="flex items-center gap-2 text-sm"
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Status Picker Modal */}
      {selectedDate && (
        <StatusPickerModal
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          date={selectedDate}
          initialStatus={calendarData.find((d) => d.date === selectedDate)?.status}
          initialMood={calendarData.find((d) => d.date === selectedDate)?.mood}
          initialNotes={calendarData.find((d) => d.date === selectedDate)?.notes}
          onSuccess={handleStatusUpdate}
        />
      )}
    </div>
  );
}

