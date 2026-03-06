import { getOutputMode, getStringFlag } from "../flags";
import { listAllTasks, type SolidTimeClient } from "../api";
import { resolveProjectAndTask } from "../context";
import { printJson, printTable } from "../output";
import type { CliFlags, CommandContext } from "../types";

export async function handleTasksList(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const projectInput = getStringFlag(flags, "project");
  const done = normalizeTriState(getStringFlag(flags, "done"));
  const resolved = projectInput
    ? await resolveProjectAndTask(client, context.config.organizationId!, { projectInput })
    : { project: null, task: null };

  const tasks = await listAllTasks(client, context.config.organizationId!, {
    projectId: resolved.project?.id,
    done,
  });

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(tasks);
    return;
  }

  printTable(
    tasks.map((task) => ({
      id: task.id,
      name: task.name,
      projectId: task.project_id,
      done: task.is_done,
      spent: task.spent_time,
    })),
  );
}

function normalizeTriState(value: string | undefined): "true" | "false" | "all" {
  if (value === "true" || value === "false" || value === "all") {
    return value;
  }

  return "false";
}
