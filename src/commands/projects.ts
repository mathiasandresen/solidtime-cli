import { getOutputMode, getStringFlag } from "../flags";
import { listAllProjects, type SolidTimeClient } from "../api";
import { printJson, printTable } from "../output";
import type { CliFlags, CommandContext } from "../types";

export async function handleProjectsList(
  flags: CliFlags,
  context: CommandContext,
  client: SolidTimeClient,
) {
  const archived = normalizeTriState(getStringFlag(flags, "archived"));
  const projects = await listAllProjects(client, context.config.organizationId!, archived);

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(projects);
    return;
  }

  printTable(
    projects.map((project) => ({
      id: project.id,
      name: project.name,
      archived: project.is_archived,
      billable: project.is_billable,
      public: project.is_public,
      spent: project.spent_time,
    })),
  );
}

function normalizeTriState(value: string | undefined): "true" | "false" | "all" {
  if (value === "true" || value === "false" || value === "all") {
    return value;
  }

  return "false";
}
