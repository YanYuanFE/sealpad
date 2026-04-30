import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

/**
 * Saturn-styled calendar built on react-day-picker v9.
 * Brand colours injected via the library's CSS variables; sharp 0.69px
 * radius for day cells; mono font on numerals to match the rest of the
 * Sealed-Geometry system.
 */
export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3 bg-white", className)}
      style={
        {
          "--rdp-accent-color": "#FF5100",
          "--rdp-accent-background-color": "#FFEDD5",
          "--rdp-today-color": "#FF5100",
          "--rdp-day_button-border-radius": "0.69px",
          "--rdp-selected-border": "0.69px solid #FF5100",
          "--rdp-font-family": "'JetBrains Mono', ui-monospace, monospace",
          "--rdp-day-font": "0.85rem 'JetBrains Mono', monospace",
          "--rdp-weekday-text-transform": "uppercase",
          "--rdp-weekday-font-size": "0.65rem",
          "--rdp-weekday-opacity": "0.6",
          "--rdp-nav_button-height": "1.75rem",
          "--rdp-nav_button-width": "1.75rem",
        } as React.CSSProperties
      }
      classNames={{
        caption_label:
          "text-xs font-mono tracking-widest uppercase text-slate-900",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <CaretLeft size={14} weight="bold" />;
          }
          return <CaretRight size={14} weight="bold" />;
        },
      }}
      {...props}
    />
  );
}
