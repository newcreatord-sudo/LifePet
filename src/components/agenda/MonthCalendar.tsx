import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import type { AgendaEvent } from "@/types";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeekMonday(d: Date) {
  const cur = new Date(d);
  const day = cur.getDay();
  const diff = (day + 6) % 7;
  cur.setDate(cur.getDate() - diff);
  cur.setHours(0, 0, 0, 0);
  return cur;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthCalendar(props: {
  month: Date;
  selectedDay: Date;
  events: AgendaEvent[];
  onMonthChange: (next: Date) => void;
  onSelectDay: (d: Date) => void;
}) {
  const { month, selectedDay, events, onMonthChange, onSelectDay } = props;

  const { gridStart, days, counts } = useMemo(() => {
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const gridStart = startOfWeekMonday(mStart);
    const gridEnd = new Date(startOfWeekMonday(new Date(mEnd.getFullYear(), mEnd.getMonth(), mEnd.getDate() + 1)));
    gridEnd.setDate(gridEnd.getDate() + 6);

    const counts: Record<string, number> = {};
    for (const e of events) {
      const d = new Date(e.dueAt);
      d.setHours(0, 0, 0, 0);
      const k = ymd(d);
      counts[k] = (counts[k] || 0) + 1;
    }

    const days: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    return { gridStart, days, counts };
  }, [events, month]);

  const monthLabel = useMemo(() => {
    return month.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [month]);

  const selectedKey = useMemo(() => {
    const d = new Date(selectedDay);
    d.setHours(0, 0, 0, 0);
    return ymd(d);
  }, [selectedDay]);

  const monthStart = useMemo(() => startOfMonth(month).getTime(), [month]);
  const monthEnd = useMemo(() => endOfMonth(month).getTime(), [month]);

  const weekdayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="lp-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold capitalize">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="lp-btn-icon"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label="Mese precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="lp-btn-icon"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="Mese successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-[11px] font-medium text-center" style={{ color: "rgb(var(--lp-muted))" }}>
            {w}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const ts = d.getTime();
          const inMonth = ts >= monthStart && ts <= monthEnd;
          const k = ymd(d);
          const isSelected = k === selectedKey;
          const c = counts[k] || 0;

          return (
            <button
              key={`${gridStart.getTime()}-${k}`}
              type="button"
              onClick={() => onSelectDay(d)}
              className={
                isSelected
                  ? "rounded-xl border px-2 py-2 text-sm text-left shadow-sm"
                  : "rounded-xl border px-2 py-2 text-sm text-left"
              }
              style={
                isSelected
                  ? {
                      borderColor: "rgba(var(--lp-primary),0.35)",
                      backgroundColor: "rgba(var(--lp-primary),0.08)",
                    }
                  : {
                      borderColor: "rgba(var(--lp-ink),0.10)",
                      backgroundColor: inMonth ? "rgba(var(--lp-surface),0.55)" : "rgba(var(--lp-surface),0.35)",
                    }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className={inMonth ? "font-medium" : "font-medium opacity-55"}>{d.getDate()}</div>
                {c ? (
                  <div className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(var(--lp-accent-1),0.14)", color: "rgb(var(--lp-ink))" }}>
                    {c}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

