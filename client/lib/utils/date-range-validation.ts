import { toast } from 'sonner';

export const MAX_DATE_RANGE_DAYS = 90;

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

/**
 * Validates and adjusts a date range to ensure it doesn't exceed MAX_DATE_RANGE_DAYS
 * @param range - The date range to validate
 * @param showToast - Whether to show a toast notification when adjusting (default: true)
 * @returns The validated and potentially adjusted date range
 */
export function validateAndAdjustDateRange(
  range: DateRange,
  showToast: boolean = true
): DateRange {
  if (!range.from || !range.to) {
    return range;
  }

  const daysDiff = Math.ceil(
    (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff > MAX_DATE_RANGE_DAYS) {
    // Auto-adjust: keep the end date and move start date back MAX_DATE_RANGE_DAYS
    const adjustedFrom = new Date(range.to);
    adjustedFrom.setDate(adjustedFrom.getDate() - MAX_DATE_RANGE_DAYS);
    adjustedFrom.setHours(0, 0, 0, 0);

    if (showToast) {
      toast.warning(`Date range adjusted to maximum ${MAX_DATE_RANGE_DAYS} days`, {
        description: `Selected range was ${daysDiff} days. Adjusted to last ${MAX_DATE_RANGE_DAYS} days.`,
      });
    }

    return { from: adjustedFrom, to: range.to };
  }

  return range;
}

/**
 * Checks if a date range exceeds the maximum allowed days
 * @param range - The date range to check
 * @returns true if the range exceeds the maximum, false otherwise
 */
export function exceedsMaxDateRange(range: DateRange): boolean {
  if (!range.from || !range.to) {
    return false;
  }

  const daysDiff = Math.ceil(
    (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysDiff > MAX_DATE_RANGE_DAYS;
}

