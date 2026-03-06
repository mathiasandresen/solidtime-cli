import type { TimeEntry } from "@solidtime/api";

import { getBooleanFlag, getOutputMode, getStringArrayFlag, getStringFlag } from "../flags";
import { type SolidTimeClient } from "../api";
import { getTimerStatus, resolveProjectAndTask } from "../context";
import { CliError } from "../errors";
import { formatDuration, formatElapsedFrom, formatTimestamp, printJson, printKeyValue } from "../output";
import type { CliFlags, CommandContext } from "../types";

export async function handleTimerStatus(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const status = await getTimerStatus(client, context.config.organizationId!);

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(status);
    return;
  }

  if (!status.entry) {
    console.log("No active timer.");
    return;
  }

  printTimerDetails(status.entry, status.project?.name, status.task?.name);
}

export async function handleTimerStart(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const currentStatus = await getTimerStatus(client, context.config.organizationId!);
  if (currentStatus.entry) {
    throw new CliError(`An active timer is already running (${currentStatus.entry.id}).`);
  }

  const description = getStringFlag(flags, "description");
  const projectInput = getStringFlag(flags, "project");
  const taskInput = getStringFlag(flags, "task");
  const billable =
    getBooleanFlag(flags, "billable") ??
    context.config.defaultBillable;
  const timestamp = parseTimestampInput(getStringFlag(flags, "at")) ?? new Date().toISOString();
  const tags = getStringArrayFlag(flags, "tag");
  const { project, task } = await resolveProjectAndTask(client, context.config.organizationId!, {
    projectInput,
    taskInput,
  });

  const response = await client.createTimeEntry(
    {
      member_id: context.member.id,
      start: timestamp,
      end: null,
      billable,
      description: description ?? null,
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

  console.log(`Started timer ${response.data.id}`);
  printTimerDetails(response.data, project?.name, task?.name);
}

export async function handleTimerStop(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const status = await getTimerStatus(client, context.config.organizationId!);
  if (!status.entry) {
    throw new CliError("No active timer to stop.");
  }

  const stopTime = parseTimestampInput(getStringFlag(flags, "at")) ?? new Date().toISOString();
  const response = await client.updateTimeEntry(
    {
      end: stopTime,
    },
    {
      params: {
        organization: context.config.organizationId!,
        timeEntry: status.entry.id,
      },
    },
  );

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(response.data);
    return;
  }

  console.log(`Stopped timer ${response.data.id}`);
  printTimerDetails(response.data, status.project?.name, status.task?.name);
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

function printTimerDetails(entry: TimeEntry, projectName?: string, taskName?: string) {
  printKeyValue([
    ["id", entry.id],
    ["description", entry.description],
    ["start", formatTimestamp(entry.start)],
    ["end", formatTimestamp(entry.end)],
    ["elapsed", entry.end ? formatDuration(entry.duration) : formatElapsedFrom(entry.start)],
    ["project", projectName ?? entry.project_id],
    ["task", taskName ?? entry.task_id],
    ["billable", entry.billable],
  ]);
}
