import type { GroupedDataEntries } from "@solidtime/api";

import {
  getAggregatedTimeEntries,
  listAllProjects,
  type SolidTimeClient,
} from "../api";
import { getOutputMode } from "../flags";
import { CliError } from "../errors";
import { formatDuration, printJson, printTable } from "../output";
import type { CliFlags, CommandContext } from "../types";

type Weekday = CommandContext["me"]["week_start"];

type ProjectReportRow = {
  project: string;
  totalSeconds: number;
  billableSeconds: number;
  nonBillableSeconds: number;
};

export async function handleReportsWeek(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
  offsetInput?: string,
) {
  const offset = parseWeekOffset(offsetInput);
  const range = getWeekRange(new Date(), context.me.timezone, context.me.week_start, offset);

  const [projects, aggregate] = await Promise.all([
    listAllProjects(client, context.config.organizationId!, "all"),
    getAggregatedTimeEntries(client, context.config.organizationId!, {
      member_id: context.member.id,
      group: "project",
      sub_group: "billable",
      start: range.startUtc,
      end: range.endUtc,
    }),
  ]);

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const projectBreakdown = buildProjectBreakdown(aggregate.grouped_data, projectNames);
  const totalSeconds = aggregate.seconds ?? 0;
  const billableSeconds = projectBreakdown.reduce((sum, row) => sum + row.billableSeconds, 0);
  const nonBillableSeconds = Math.max(0, totalSeconds - billableSeconds);
  const billablePercentage = totalSeconds > 0 ? (billableSeconds / totalSeconds) * 100 : 0;

  const payload = {
    week: {
      offset,
      start: range.startUtc,
      end: range.endUtc,
      label: range.label,
      timezone: context.me.timezone,
      weekStart: context.me.week_start,
    },
    summary: {
      totalSeconds,
      billableSeconds,
      nonBillableSeconds,
      billablePercentage: Number(billablePercentage.toFixed(1)),
    },
    projects: projectBreakdown.map((row) => ({
      project: row.project,
      totalSeconds: row.totalSeconds,
      billableSeconds: row.billableSeconds,
      nonBillableSeconds: row.nonBillableSeconds,
    })),
  };

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(payload);
    return;
  }

  console.log(`Week: ${range.label}`);
  console.log(`Total: ${formatDuration(totalSeconds)}`);
  console.log(`Billable: ${formatDuration(billableSeconds)} (${formatPercentage(billablePercentage)})`);
  console.log(`Non-billable: ${formatDuration(nonBillableSeconds)}`);
  console.log("");

  if (projectBreakdown.length === 0) {
    console.log("No time tracked in this week.");
    return;
  }

  printTable(
    projectBreakdown.map((row) => ({
      project: row.project,
      total: formatDuration(row.totalSeconds),
      billable: formatDuration(row.billableSeconds),
      nonBillable: formatDuration(row.nonBillableSeconds),
    })),
  );
}

function parseWeekOffset(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const offset = Number.parseInt(value, 10);
  if (!Number.isInteger(offset)) {
    throw new CliError(`Invalid week offset: ${value}`);
  }

  return offset;
}

function buildProjectBreakdown(
  groupedData: GroupedDataEntries,
  projectNames: Map<string, string>,
): ProjectReportRow[] {
  const rows = (groupedData ?? []).map((group) => {
    const projectKey = group.key ?? "";
    const billableSeconds = (group.grouped_data ?? []).reduce((sum, item) => {
      return isBillableGroup(item.key) ? sum + item.seconds : sum;
    }, 0);

    return {
      project: getProjectName(projectKey, projectNames),
      totalSeconds: group.seconds,
      billableSeconds,
      nonBillableSeconds: Math.max(0, group.seconds - billableSeconds),
    };
  });

  return rows.sort((left, right) => right.totalSeconds - left.totalSeconds);
}

function isBillableGroup(value: string | null): boolean {
  return value === "true" || value === "1";
}

function getProjectName(projectId: string, projectNames: Map<string, string>): string {
  if (!projectId) {
    return "No project";
  }

  return projectNames.get(projectId) ?? projectId;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getWeekRange(now: Date, timezone: string, weekStart: Weekday, offset: number) {
  const todayParts = getZonedParts(now, timezone);
  const weekdayIndex = getWeekdayIndex(now, timezone);
  const startOffset = mod(weekdayIndex - weekdayToIndex(weekStart), 7) + offset * 7;
  const startDate = shiftDate(todayParts.year, todayParts.month, todayParts.day, -startOffset);
  const endDate = shiftDate(startDate.year, startDate.month, startDate.day, 7);

  return {
    startUtc: zonedMidnightToUtcIso(startDate.year, startDate.month, startDate.day, timezone),
    endUtc: zonedMidnightToUtcIso(endDate.year, endDate.month, endDate.day, timezone),
    label: `${formatDateLabel(startDate, timezone)} - ${formatDateLabel(
      shiftDate(endDate.year, endDate.month, endDate.day, -1),
      timezone,
    )}`,
  };
}

function getWeekdayIndex(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone,
  })
    .format(date)
    .toLowerCase();

  return weekdayToIndex(weekday as Weekday);
}

function weekdayToIndex(value: Weekday): number {
  switch (value) {
    case "sunday":
      return 0;
    case "monday":
      return 1;
    case "tuesday":
      return 2;
    case "wednesday":
      return 3;
    case "thursday":
      return 4;
    case "friday":
      return 5;
    case "saturday":
      return 6;
  }

  throw new CliError(`Unsupported week start: ${value}`);
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(getPart(parts, "year")),
    month: Number(getPart(parts, "month")),
    day: Number(getPart(parts, "day")),
  };
}

function formatDateLabel(
  date: { year: number; month: number; day: number },
  timezone: string,
): string {
  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(utcDate);
}

function zonedMidnightToUtcIso(year: number, month: number, day: number, timezone: string): string {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timezone);
  return formatApiTimestamp(new Date(utcGuess - offset));
}

function getTimeZoneOffsetMilliseconds(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const asUtc = Date.UTC(
    Number(getPart(parts, "year")),
    Number(getPart(parts, "month")) - 1,
    Number(getPart(parts, "day")),
    Number(getPart(parts, "hour")),
    Number(getPart(parts, "minute")),
    Number(getPart(parts, "second")),
  );

  return asUtc - date.getTime();
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((item) => item.type === type)?.value;
  if (!part) {
    throw new CliError(`Could not determine ${type} for report range.`);
  }

  return part;
}

function shiftDate(year: number, month: number, day: number, deltaDays: number) {
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function formatApiTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
