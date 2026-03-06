import type { CliFlags, OutputMode } from "./types";

export function hasFlag(flags: CliFlags, name: string): boolean {
  return getFlagRecord(flags)[name] !== undefined;
}

export function getStringFlag(flags: CliFlags, name: string): string | undefined {
  const value = getFlagRecord(flags)[name];
  if (value === undefined || typeof value === "boolean") {
    return undefined;
  }

  return Array.isArray(value) ? getLastString(value) : typeof value === "string" ? value : undefined;
}

export function getStringArrayFlag(flags: CliFlags, name: string): string[] {
  const value = getFlagRecord(flags)[name];

  if (value === undefined || typeof value === "boolean") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return typeof value === "string" ? [value] : [];
}

export function getBooleanFlag(flags: CliFlags, name: string): boolean | undefined {
  const value = getFlagRecord(flags)[name];

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const last = value.at(-1);
    return typeof last === "boolean" ? last : undefined;
  }

  return undefined;
}

export function getOutputMode(flags: CliFlags): OutputMode | undefined {
  if (getBooleanFlag(flags, "json")) {
    return "json";
  }

  const output = getStringFlag(flags, "output");
  if (output === "json" || output === "table") {
    return output;
  }

  return undefined;
}

function getLastString(values: unknown[]): string | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function getFlagRecord(flags: CliFlags): Record<string, unknown> {
  return flags as Record<string, unknown>;
}
