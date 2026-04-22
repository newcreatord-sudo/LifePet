import type { AgendaEvent, AgendaSeries } from "@/types";

export function normalizeAgendaTitle(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function agendaEventDedupeKey(title: string, kind: AgendaEvent["kind"], dueAt: number) {
  const bucket = Math.floor(dueAt / 60_000);
  return `${kind}|${bucket}|${normalizeAgendaTitle(title)}`;
}

export function agendaSeriesDedupeKey(series: Pick<AgendaSeries, "title" | "kind" | "recurrence" | "timeOfDay">) {
  const base = `${series.kind}|${normalizeAgendaTitle(series.title)}|${String(series.timeOfDay || "").trim()}`;
  if (series.recurrence.type === "daily") return `${base}|daily`;
  const w = Array.from(new Set(series.recurrence.weekdays || [])).slice().sort((a, b) => a - b);
  return `${base}|weekly|${w.join(",")}`;
}

