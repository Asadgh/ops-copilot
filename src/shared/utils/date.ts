import { addMinutes, format, getISOWeek, isSameDay, parse, startOfDay } from "date-fns";
import type { Shift } from "../types";

export function getMonthLabel(timestamp = Date.now()): string {
  return format(new Date(timestamp), "MMMM yyyy");
}

export function getWeekLabel(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${format(date, "yyyy")}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

export function toDateKey(timestamp = Date.now()): string {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

export function toTimeLabel(timestamp: number): string {
  return format(new Date(timestamp), "HH:mm");
}

export function parseClockTime(dateKey: string, value: string): Date {
  return parse(`${dateKey} ${value}`, "yyyy-MM-dd HH:mm", new Date());
}

export function addClockMinutes(dateKey: string, value: string, minutes: number): string {
  return format(addMinutes(parseClockTime(dateKey, value), minutes), "HH:mm");
}

export function isWithinShift(shift: Shift, when = new Date()): boolean {
  const day = format(when, "EEE");
  if (!shift.days.includes(day)) return false;
  const dateKey = toDateKey(when.getTime());
  const start = parseClockTime(dateKey, shift.startHour);
  let end = parseClockTime(dateKey, shift.endHour);
  if (end <= start) {
    end = addMinutes(end, 24 * 60);
  }
  const candidate = when < start && end.getDate() !== start.getDate() ? addMinutes(when, 24 * 60) : when;
  return candidate >= start && candidate <= end;
}

export function isToday(timestamp: number): boolean {
  return isSameDay(new Date(timestamp), new Date());
}

export function startOfToday(): number {
  return startOfDay(new Date()).getTime();
}

export function endOfToday(): number {
  return startOfToday() + 24 * 60 * 60 * 1000 - 1;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}
