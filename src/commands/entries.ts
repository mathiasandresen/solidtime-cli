import { getBooleanFlag, getOutputMode, getStringFlag } from "../flags";
import { type SolidTimeClient } from "../api";
import { CliError } from "../errors";
import { formatDuration, formatTimestamp, printJson, printTable } from "../output";
import type { CliFlags, CommandContext } from "../types";

export async function handleEntriesList(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const start = parseTimestampInput(getStringFlag(flags, "from"));
  const end = parseTimestampInput(getStringFlag(flags, "to"));
  const active = getBooleanFlag(flags, "active");
  const limit = parseLimit(getStringFlag(flags, "limit"));

  const response = await client.getTimeEntries({
    params: {
      organization: context.config.organizationId!,
    },
    queries: {
      member_id: context.member.id,
      start,
      end,
      active: active === undefined ? undefined : active ? "true" : "false",
      limit,
    },
  });

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(response);
    return;
  }

  printTable(
    response.data.map((entry) => ({
      id: entry.id,
      start: formatTimestamp(entry.start),
      end: formatTimestamp(entry.end),
      duration: entry.end ? formatDuration(entry.duration) : "running",
      projectId: entry.project_id,
      taskId: entry.task_id,
      description: entry.description,
      billable: entry.billable,
    })),
  );
}

function parseTimestampInput(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CliError(`Invalid timestamp: ${value}`);
  }

  return date.toISOString();
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new CliError("--limit must be an integer between 1 and 500.");
  }

  return limit;
}
