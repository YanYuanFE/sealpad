import * as React from "react";
import { format } from "date-fns";
import { CalendarBlank, Clock } from "@phosphor-icons/react";
import type { Matcher } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value?: Date;
  onChange?: (d: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  /** Earliest selectable date (inclusive). */
  fromDate?: Date;
  /** Latest selectable date (inclusive). */
  toDate?: Date;
};

/**
 * shadcn-style date+time picker. Trigger is a styled button showing the
 * current value (or placeholder); clicking opens a popover with a calendar
 * for the date and an HH:mm input for the time. Both edits compose into a
 * single Date passed back to the parent via `onChange`.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
  error,
  fromDate,
  toDate,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const timeStr = value ? format(value, "HH:mm") : "00:00";

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      onChange?.(undefined);
      return;
    }
    const [h, m] = timeStr.split(":").map(Number);
    const merged = new Date(newDate);
    merged.setHours(h ?? 0, m ?? 0, 0, 0);
    onChange?.(merged);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const merged = new Date(value ?? new Date());
    merged.setHours(h, m, 0, 0);
    onChange?.(merged);
  };

  const disabledMatcher = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (fromDate) {
      // Disable everything strictly before the day of fromDate
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      matchers.push({ before: from });
    }
    if (toDate) matchers.push({ after: toDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [fromDate, toDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center justify-between gap-2 border bg-white px-2.5 py-1 text-sm font-mono transition-colors",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:border-brand-500",
            error
              ? "border-rose-400"
              : "border-slate-200 hover:border-slate-400 aria-expanded:border-brand-500",
            !value && "text-slate-400",
            className,
          )}
          style={{ borderRadius: "0.69px" }}
        >
          <span className="truncate">
            {value ? format(value, "yyyy-MM-dd  HH:mm") : placeholder}
          </span>
          <CalendarBlank
            size={14}
            weight="regular"
            className="text-slate-400 shrink-0"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          disabled={disabledMatcher}
          autoFocus
        />
        <div className="border-t border-slate-200 p-3 flex items-center gap-3">
          <Clock size={14} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
            TIME
          </span>
          <input
            type="time"
            value={timeStr}
            onChange={handleTimeChange}
            className="flex-1 border border-slate-200 px-2.5 py-1 text-sm font-mono focus:outline-none focus:border-brand-500 hover:border-slate-400 transition-colors"
            style={{ borderRadius: "0.69px" }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
