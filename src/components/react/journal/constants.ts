import type { JournalLesson, LessonStatus, Program } from "./api";

export const STATUS: Record<Exclude<LessonStatus, "none">, { label: string }> = {
  present: { label: "Пришёл" },
  absent: { label: "Не был" },
  excused: { label: "Уважительная причина" },
};

export const PROGRAMS: Record<Program, { label: string; detail: string }> = {
  standard: { label: "Обычный", detail: "3 раза в неделю · 12 ч в месяц" },
  intensive: { label: "Интенсив", detail: "4–5 раз в неделю · 20 ч в месяц" },
};

// Timetable rows reference groups by schedule slot (student_groups.schedule_slot),
// so renaming a group keeps it on the timetable.
export type ScheduleRow =
  | { time: string; type: "group"; slot: number }
  | { time: string; type: "break" | "lunch"; label: string };

export const SCHEDULES: Record<"mwf" | "tt", { label: string; rows: ScheduleRow[] }> = {
  mwf: {
    label: "Пн · Ср · Пт",
    rows: [
      { time: "10:00–11:00", type: "group", slot: 1 },
      { time: "11:00–11:10", type: "break", label: "Перерыв" },
      { time: "11:10–12:10", type: "group", slot: 2 },
      { time: "12:10–12:20", type: "break", label: "Перерыв" },
      { time: "12:20–13:20", type: "group", slot: 3 },
      { time: "13:20–13:30", type: "break", label: "Перерыв" },
      { time: "13:30–14:30", type: "group", slot: 4 },
      { time: "14:30–15:30", type: "lunch", label: "Обед" },
      { time: "15:30–16:30", type: "group", slot: 5 },
      { time: "16:30–16:40", type: "break", label: "Перерыв" },
      { time: "16:40–17:40", type: "group", slot: 6 },
    ],
  },
  tt: {
    label: "Вт · Чт",
    rows: [
      { time: "10:00–10:45", type: "group", slot: 1 },
      { time: "10:45–10:50", type: "break", label: "Перерыв" },
      { time: "10:50–11:35", type: "group", slot: 1 },
      { time: "11:35–11:40", type: "break", label: "Перерыв" },
      { time: "11:40–12:25", type: "group", slot: 2 },
      { time: "12:25–12:30", type: "break", label: "Перерыв" },
      { time: "12:30–13:15", type: "group", slot: 2 },
      { time: "13:15–13:20", type: "break", label: "Перерыв" },
      { time: "13:20–14:05", type: "group", slot: 3 },
      { time: "14:05–14:10", type: "break", label: "Перерыв" },
      { time: "14:10–14:55", type: "group", slot: 3 },
      { time: "14:55–15:55", type: "lunch", label: "Обед" },
      { time: "15:55–16:40", type: "group", slot: 4 },
      { time: "16:40–16:45", type: "break", label: "Перерыв" },
      { time: "16:45–17:30", type: "group", slot: 4 },
      { time: "17:30–17:35", type: "break", label: "Перерыв" },
      { time: "17:35–18:20", type: "group", slot: 5 },
      { time: "18:20–18:25", type: "break", label: "Перерыв" },
      { time: "18:25–19:10", type: "group", slot: 5 },
      { time: "19:10–19:15", type: "break", label: "Перерыв" },
      { time: "19:15–20:00", type: "group", slot: 6 },
      { time: "20:00–20:05", type: "break", label: "Перерыв" },
      { time: "20:05–20:50", type: "group", slot: 6 },
    ],
  },
};

/** Local calendar date as YYYY-MM-DD (not UTC, which can be off by a day). */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "2026-09-21" → "21.09" */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

export function statusClass(status: LessonStatus): string {
  return status === "none" ? "none" : status;
}

export function tooltipFor(lesson: JournalLesson) {
  const label = lesson.status === "none" ? "не отмечено" : STATUS[lesson.status].label;
  return {
    dateLabel: `${lesson.date}${lesson.time ? " · " + lesson.time : ""} — ${label}`,
    topic: lesson.topic || "Тема не указана",
  };
}
