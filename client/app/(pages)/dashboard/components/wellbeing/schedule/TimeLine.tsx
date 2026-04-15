/**
 * @file TimeLine Component
 * @description 24-hour timeline view for schedule items
 */

"use client";


interface TimeLineProps {
  startHour?: number;
  endHour?: number;
  intervalMinutes?: number;
}

export function TimeLine({ startHour = 0, endHour = 24, intervalMinutes = 30 }: TimeLineProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const intervalsPerHour = 60 / intervalMinutes;

  return (
    <div className="relative">
      {/* Time markers */}
      <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col">
        {hours.map((hour) => (
          <div key={hour} className="flex-1 border-t border-slate-700/50 relative">
            <div className="absolute left-0 top-0 px-2 text-xs text-slate-500 font-medium">
              {hour.toString().padStart(2, "0")}:00
            </div>
            {/* Sub-intervals */}
            {Array.from({ length: intervalsPerHour - 1 }, (_, i) => i + 1).map((interval) => (
              <div
                key={`${hour}-${interval}`}
                className="absolute left-0 right-0 border-t border-slate-800/30"
                style={{
                  top: `${(interval / intervalsPerHour) * 100}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Current time indicator */}
      <CurrentTimeIndicator />
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const position = ((currentHour * 60 + currentMinute) / (24 * 60)) * 100;

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${position}%` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
        <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent" />
      </div>
    </div>
  );
}


