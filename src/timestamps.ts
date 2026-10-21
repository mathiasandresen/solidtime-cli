import { CliError } from "./errors";

const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Parses CLI timestamp input into a UTC ISO string.
 * `HH:MM` means today, and offset-less `YYYY-MM-DD[ HH:MM[:SS]]` means that wall time, both in `timezone`.
 * Anything else goes through `new Date()` (shortcut: offset-less free-form dates use the machine timezone).
 */
export function parseTimestampInput(
  value: string | undefined,
  timezone: string,
  now: Date = new Date(),
): string | undefined {
  if (!value) {
    return undefined;
  }

  const input = value.trim();
  const timeOnly = TIME_ONLY.exec(input);
  const dateTime = DATE_TIME.exec(input);

  let wallTime: number[] | undefined;
  if (timeOnly) {
    const { year, month, day } = getZonedDate(now, timezone);
    wallTime = [year, month, day, Number(timeOnly[1]), Number(timeOnly[2]), Number(timeOnly[3] ?? 0)];
  } else if (dateTime) {
    wallTime = [
      Number(dateTime[1]),
      Number(dateTime[2]),
      Number(dateTime[3]),
      Number(dateTime[4] ?? 0),
      Number(dateTime[5] ?? 0),
      Number(dateTime[6] ?? 0),
    ];
  }

  const date = wallTime ? zonedWallTimeToDate(wallTime, timezone) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new CliError(`Invalid timestamp: ${value}`);
  }

  return formatApiTimestamp(date);
}

// The API rejects fractional seconds (it requires Y-m-d\TH:i:s\Z).
export function formatApiTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function zonedWallTimeToDate(wallTime: number[], timezone: string): Date {
  const [year, month, day, hour, minute, second] = wallTime as [number, number, number, number, number, number];
  const wallAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Rejects rollovers like 25:00 or 2026-02-31 instead of silently shifting the date.
  if (
    wallAsUtc.getUTCFullYear() !== year ||
    wallAsUtc.getUTCMonth() !== month - 1 ||
    wallAsUtc.getUTCDate() !== day ||
    wallAsUtc.getUTCHours() !== hour ||
    wallAsUtc.getUTCMinutes() !== minute ||
    wallAsUtc.getUTCSeconds() !== second
  ) {
    return new Date(Number.NaN);
  }

  // Offset is looked up twice so times just after a DST change resolve with the right offset.
  const firstGuess = wallAsUtc.getTime() - getOffsetMilliseconds(wallAsUtc, timezone);
  return new Date(wallAsUtc.getTime() - getOffsetMilliseconds(new Date(firstGuess), timezone));
}

function getZonedDate(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function getOffsetMilliseconds(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function getZonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
