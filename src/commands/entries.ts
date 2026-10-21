import { getBooleanFlag, getOutputMode, getStringArrayFlag, getStringFlag } from "../flags";
import { type SolidTimeClient } from "../api";
import { resolveProjectAndTask } from "../context";
import { CliError } from "../errors";
import { formatDuration, formatTimestamp, printJson, printTable } from "../output";
import { formatApiTimestamp, parseTimestampInput } from "../timestamps";
import type { CliFlags, CommandContext } from "../types";
import { printTimerDetails } from "./timer";

export async function handleEntriesList(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const start = parseTimestampInput(getStringFlag(flags, "from"), context.me.timezone);
  const end = parseTimestampInput(getStringFlag(flags, "to"), context.me.timezone);
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
      start: formatTimestamp(entry.start, context.me.timezone),
      end: formatTimestamp(entry.end, context.me.timezone),
      duration: entry.end ? formatDuration(entry.duration) : "running",
      projectId: entry.project_id,
      taskId: entry.task_id,
      description: entry.description,
      billable: entry.billable,
    })),
  );
}

export async function handleEntriesCreate(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const start = parseTimestampInput(getStringFlag(flags, "start"), context.me.timezone);
  if (!start) {
    throw new CliError("--start is required.");
  }

  const end = parseTimestampInput(getStringFlag(flags, "end"), context.me.timezone) ?? formatApiTimestamp();
  if (end <= start) {
    throw new CliError("--end must be after --start.");
  }

  const tags = getStringArrayFlag(flags, "tag");
  const { project, task } = await resolveProjectAndTask(client, context.config.organizationId!, {
    projectInput: getStringFlag(flags, "project"),
    taskInput: getStringFlag(flags, "task"),
  });

  const response = await client.createTimeEntry(
    {
      member_id: context.member.id,
      start,
      end,
      billable: getBooleanFlag(flags, "billable") ?? context.config.defaultBillable,
      description: getStringFlag(flags, "description") ?? null,
      project_id: project?.id ?? null,
      task_id: task?.id ?? null,
      tags: tags.length > 0 ? tags : null,
    },
    {
      params: {
        organization: context.config.organizationId!,
      },
    },
  );

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(response.data);
    return;
  }

  console.log(`Created entry ${response.data.id}`);
  printTimerDetails(response.data, context.me.timezone, project?.name, task?.name);
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
