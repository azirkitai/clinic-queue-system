import type { MediaSchedule } from "@shared/schema";

const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidScheduleTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getMalaysiaParts(now: Date): { day: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MALAYSIA_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    day: weekdays[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function previousDay(day: number): number {
  return (day + 6) % 7;
}

export function isScheduleActive(schedule: MediaSchedule, now: Date = new Date()): boolean {
  if (!schedule.isActive || !isValidScheduleTime(schedule.startTime) || !isValidScheduleTime(schedule.endTime)) {
    return false;
  }

  const days = Array.isArray(schedule.days)
    ? schedule.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  if (days.length === 0) return false;

  const { day, minutes } = getMalaysiaParts(now);
  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);

  if (start === end) {
    return days.includes(day);
  }

  if (start < end) {
    return days.includes(day) && minutes >= start && minutes < end;
  }

  // Overnight schedules remain active after midnight on the following day.
  return (
    (days.includes(day) && minutes >= start) ||
    (days.includes(previousDay(day)) && minutes < end)
  );
}

export function scheduleDayLabels(days: unknown): string[] {
  const labels = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  if (!Array.isArray(days)) return [];
  return days
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b)
    .map((day) => labels[day]);
}