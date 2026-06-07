import { addMinutes, format, getISOWeek, isSameDay, parse, startOfDay } from "date-fns";
import type { Shift } from "../types";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clockToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function previousWeekDay(day: string): string {
  const index = weekDays.indexOf(day);
  return weekDays[(index + weekDays.length - 1) % weekDays.length] ?? day;
}

function zonedShiftParts(when: Date, timezone: string): { day: string; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(when);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return { day: value("weekday"), minutes: Number(value("hour")) * 60 + Number(value("minute")) };
  } catch {
    return { day: format(when, "EEE"), minutes: when.getHours() * 60 + when.getMinutes() };
  }
}

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
  const { day, minutes } = zonedShiftParts(when, shift.timezone);
  const start = clockToMinutes(shift.startHour);
  const end = clockToMinutes(shift.endHour);
  if (end > start) return shift.days.includes(day) && minutes >= start && minutes <= end;
  return (shift.days.includes(day) && minutes >= start) || (shift.days.includes(previousWeekDay(day)) && minutes <= end);
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
