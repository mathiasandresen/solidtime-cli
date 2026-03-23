import type { TableRow } from "./types";

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

export function printTable(rows: TableRow[]) {
  if (rows.length === 0) {
    console.log("No results.");
    return;
  }

  const firstRow = rows[0]!;
  const columns = Object.keys(firstRow);
  const widths = new Map<string, number>();

  for (const column of columns) {
    widths.set(
      column,
      Math.max(
        column.length,
        ...rows.map((row) => stringifyCell(row[column]).length),
      ),
    );
  }

  const header = columns
    .map((column) => column.padEnd(widths.get(column) ?? column.length))
    .join("  ");

  console.log(header);
  console.log(columns.map((column) => "-".repeat(widths.get(column) ?? column.length)).join("  "));

  for (const row of rows) {
    console.log(
      columns
        .map((column) => stringifyCell(row[column]).padEnd(widths.get(column) ?? column.length))
        .join("  "),
    );
  }
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) {
    return "-";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatTimestamp(
  value: string | null | undefined,
  timezone: string | null | undefined,
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: timezone ?? "UTC",
  }).format(date);
}

export function formatElapsedFrom(start: string): string {
  const startedAt = new Date(start);
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  return formatDuration(seconds);
}

export function printKeyValue(rows: Array<[string, string | number | boolean | null | undefined]>) {
  const width = Math.max(...rows.map(([key]) => key.length));
  for (const [key, value] of rows) {
    console.log(`${key.padEnd(width)}  ${stringifyCell(value)}`);
  }
}

function stringifyCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return String(value);
}
