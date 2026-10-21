import { expect, test } from "bun:test";

import { parseTimestampInput } from "./timestamps";

const now = new Date("2026-10-21T22:30:00Z"); // already 22 Oct in Copenhagen (UTC+2)

test("HH:MM means today in the given timezone", () => {
  expect(parseTimestampInput("09:30", "Europe/Copenhagen", now)).toBe("2026-10-22T07:30:00Z");
  expect(parseTimestampInput("9:30", "America/New_York", now)).toBe("2026-10-21T13:30:00Z");
  expect(parseTimestampInput("09:30", "UTC", now)).toBe("2026-10-21T09:30:00Z");
});

test("offset-less dates use the given timezone, date-only is midnight there", () => {
  expect(parseTimestampInput("2026-10-21 09:00", "Europe/Copenhagen", now)).toBe("2026-10-21T07:00:00Z");
  expect(parseTimestampInput("2026-10-21T09:00:30", "Europe/Copenhagen", now)).toBe("2026-10-21T07:00:30Z");
  expect(parseTimestampInput("2026-10-21", "Europe/Copenhagen", now)).toBe("2026-10-20T22:00:00Z");
});

test("DST changes use the offset in force at that time", () => {
  expect(parseTimestampInput("2026-10-25 12:00", "Europe/Copenhagen", now)).toBe("2026-10-25T11:00:00Z");
  expect(parseTimestampInput("2026-10-24 12:00", "Europe/Copenhagen", now)).toBe("2026-10-24T10:00:00Z");
});

test("explicit offsets are respected", () => {
  expect(parseTimestampInput("2026-10-21T09:00:00Z", "Europe/Copenhagen", now)).toBe("2026-10-21T09:00:00Z");
  expect(parseTimestampInput("2026-10-21T09:00:00+05:00", "Europe/Copenhagen", now)).toBe("2026-10-21T04:00:00Z");
});

test("empty input is undefined and bad input throws", () => {
  expect(parseTimestampInput(undefined, "UTC", now)).toBeUndefined();
  expect(() => parseTimestampInput("25:00", "UTC", now)).toThrow("Invalid timestamp");
  expect(() => parseTimestampInput("2026-02-31", "UTC", now)).toThrow("Invalid timestamp");
  expect(() => parseTimestampInput("nonsense", "UTC", now)).toThrow("Invalid timestamp");
});
