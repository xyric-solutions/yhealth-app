"use client";

import * as React from "react";
import { CalendarIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { validateAndAdjustDateRange, MAX_DATE_RANGE_DAYS } from "@/lib/utils/date-range-validation";

interface DateRangePickerProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  className?: string;
}

const PRESETS = [
  { label: "Last 7 days", days: 7, icon: "📅" },
  { label: "Last 30 days", days: 30, icon: "📆" },
  { label: `Last ${MAX_DATE_RANGE_DAYS} days`, days: MAX_DATE_RANGE_DAYS, icon: "🗓️" },
] as const;

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<number | null>(null);

  // Check if current range matches a preset
  React.useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const daysDiff = Math.ceil(
        (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      const preset = PRESETS.find((p) => p.days === daysDiff);
      setSelectedPreset(preset ? preset.days : null);
    } else {
      setSelectedPreset(null);
    }
  }, [dateRange]);

  const handlePresetSelect = (days: number) => {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    setSelectedPreset(days);
    onDateRangeChange({ from: startDate, to: endDate });
    setIsOpen(false);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      const from = new Date(range.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(range.to);
      to.setHours(23, 59, 59, 999);
      
      const validated = validateAndAdjustDateRange({ from, to }, true);
      onDateRangeChange(validated);
      
      setSelectedPreset(null); // Clear preset when custom range is selected
    } else if (range?.from) {
      onDateRangeChange({ from: range.from, to: undefined });
      setSelectedPreset(null);
    } else {
      onDateRangeChange({ from: undefined, to: undefined });
      setSelectedPreset(null);
    }
  };

  const handleApply = () => {
    if (dateRange.from && dateRange.to) {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onDateRangeChange({ from: undefined, to: undefined });
    setSelectedPreset(null);
    setIsOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[320px] justify-start text-left font-normal",
              "bg-gradient-to-r from-white/10 via-white/5 to-transparent",
              "backdrop-blur-xl border border-white/20",
              "hover:from-white/15 hover:to-white/10 hover:border-white/30",
              "hover:shadow-lg hover:shadow-purple-500/20",
              "transition-all duration-300",
              "group relative overflow-hidden",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10 flex items-center w-full">
              <CalendarIcon className="mr-2 h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
              <span className="flex-1 truncate">
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      <span className="font-medium">{format(dateRange.from, "MMM dd")}</span>
                      <span className="mx-1 text-muted-foreground">-</span>
                      <span className="font-medium">{format(dateRange.to, "MMM dd, yyyy")}</span>
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  <span className="text-muted-foreground">Pick a date range</span>
                )}
              </span>
              {dateRange.from && dateRange.to && (
                <Sparkles className="ml-2 h-3.5 w-3.5 text-purple-400 animate-pulse" />
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 border-0 shadow-2xl" 
          align="start"
          sideOffset={8}
        >
          <div className="relative rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10 pointer-events-none" />
            
            {/* Animated border glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-pink-500/20 opacity-0 animate-pulse pointer-events-none" />
            
            <div className="relative z-10 p-6 space-y-6">
              {/* Preset options */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-purple-400 animate-pulse" />
                  <p className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                    Quick Select
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.days;
                    return (
                      <button
                        key={preset.days}
                        onClick={() => handlePresetSelect(preset.days)}
                        className={cn(
                          "relative group/preset px-4 py-3 rounded-xl",
                          "border-2 transition-all duration-300",
                          "hover:scale-105 hover:shadow-lg",
                          "flex items-center justify-center gap-2",
                          isSelected
                            ? "bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-400/50 shadow-lg shadow-purple-500/20"
                            : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 animate-pulse" />
                        )}
                        <span className="text-lg relative z-10">{preset.icon}</span>
                        <span className={cn(
                          "text-sm font-medium relative z-10 transition-colors",
                          isSelected ? "text-white" : "text-slate-300 group-hover/preset:text-white"
                        )}>
                          {preset.label}
                        </span>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50 animate-ping" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs font-medium text-slate-400 bg-slate-800/50 rounded-full">
                    OR
                  </span>
                </div>
              </div>

              {/* Calendar */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
                  <p className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                    Custom Range
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2 backdrop-blur-sm">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to,
                    }}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    className="rounded-lg"
                    classNames={{
                      months: "flex flex-col sm:flex-row gap-4 sm:gap-8",
                      month: "space-y-4",
                      month_caption: "flex justify-center pt-1 relative items-center h-10",
                      caption_label: "text-sm font-semibold text-white",
                      button_previous: "absolute left-1 h-7 w-7 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all",
                      button_next: "absolute right-1 h-7 w-7 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all",
                      month_grid: "w-full border-collapse",
                      weekdays: "flex",
                      weekday: "text-slate-400 rounded-md w-9 font-medium text-xs uppercase tracking-wider",
                      week: "flex w-full mt-2",
                      day: "h-9 w-9 text-center text-sm p-0 relative",
                      day_button: cn(
                        "h-9 w-9 p-0 font-normal rounded-lg",
                        "hover:bg-white/20 hover:text-white",
                        "transition-all duration-200",
                        "aria-selected:bg-gradient-to-r aria-selected:from-purple-500 aria-selected:to-blue-500",
                        "aria-selected:text-white aria-selected:font-semibold",
                        "aria-selected:shadow-lg aria-selected:shadow-purple-500/50"
                      ),
                      selected: "bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold shadow-lg shadow-purple-500/50",
                      today: "bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30",
                      outside: "text-slate-600 opacity-40",
                      range_middle: "bg-white/10 text-white",
                      range_end: "rounded-r-lg",
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!dateRange.from || !dateRange.to}
                  className={cn(
                    "px-6 bg-gradient-to-r from-purple-500 to-blue-500",
                    "hover:from-purple-600 hover:to-blue-600",
                    "text-white font-semibold",
                    "shadow-lg shadow-purple-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "disabled:shadow-none",
                    "transition-all duration-300",
                    "hover:scale-105 hover:shadow-xl hover:shadow-purple-500/60"
                  )}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
