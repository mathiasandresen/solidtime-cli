import type { Project, Task } from "@solidtime/api";

import { listAllMembers, listAllProjects, listAllTasks, type SolidTimeClient } from "./api";
import { CliError, isApiStatus } from "./errors";
import type { CommandContext, ResolvedProjectTask, RuntimeConfig, TimerStatus } from "./types";

export async function loadCommandContext(
  client: SolidTimeClient,
  config: RuntimeConfig,
): Promise<CommandContext> {
  const [meResponse, membershipsResponse] = await Promise.all([
    client.getMe(),
    client.getMyMemberships(),
  ]);

  const memberships = membershipsResponse.data;
  if (memberships.length === 0) {
    throw new CliError("This account does not have access to any organizations.");
  }

  const membership = config.organizationId
    ? memberships.find((item) => item.organization.id === config.organizationId)
    : memberships[0];

  if (!membership) {
    throw new CliError(
      `Organization ${config.organizationId} was not found in your memberships.`,
    );
  }

  const members = await listAllMembers(client, membership.organization.id);
  const member = members.find((item) => item.user_id === meResponse.data.id);

  if (!member) {
    throw new CliError(
      `Could not resolve your member record in organization ${membership.organization.name}.`,
    );
  }

  return {
    config: {
      ...config,
      organizationId: membership.organization.id,
    },
    membership,
    member,
    me: meResponse.data,
  };
}

export async function resolveProjectAndTask(
  client: SolidTimeClient,
  organizationId: string,
  options: {
    projectInput?: string;
    taskInput?: string;
  },
): Promise<ResolvedProjectTask> {
  let project: Project | null = null;

  if (options.projectInput) {
    const projects = await listAllProjects(client, organizationId, "all");
    project = findUniqueMatch(projects, options.projectInput, "project");
  }

  let task: Task | null = null;
  if (options.taskInput) {
    const tasks = await listAllTasks(client, organizationId, {
      projectId: project?.id,
      done: "all",
    });
    task = findUniqueMatch(tasks, options.taskInput, "task");

    if (project && task && task.project_id !== project.id) {
      throw new CliError(`Task ${task.name} does not belong to project ${project.name}.`);
    }

    if (!project && task) {
      const projects = await listAllProjects(client, organizationId, "all");
      const taskProjectId = task.project_id;
      project = projects.find((item) => item.id === taskProjectId) ?? null;
    }
  }

  return { project, task };
}

export async function getTimerStatus(
  client: SolidTimeClient,
  organizationId: string,
): Promise<TimerStatus> {
  try {
    const response = await client.getMyActiveTimeEntry();
    const entry = response.data;

    const [projects, tasks] = await Promise.all([
      listAllProjects(client, organizationId, "all"),
      listAllTasks(client, organizationId, { done: "all" }),
    ]);

    return {
      entry,
      project: projects.find((item) => item.id === entry.project_id) ?? null,
      task: tasks.find((item) => item.id === entry.task_id) ?? null,
    };
  } catch (error) {
    if (isApiStatus(error, 404)) {
      return { entry: null, project: null, task: null };
    }

    throw error;
  }
}

function findUniqueMatch<T extends { id: string; name: string }>(
  items: T[],
  input: string,
  label: string,
): T {
  const byId = items.find((item) => item.id === input);
  if (byId) {
    return byId;
  }

  const normalizedInput = input.toLowerCase();
  const exactMatches = items.filter((item) => item.name.toLowerCase() === normalizedInput);

  if (exactMatches.length === 1) {
    return exactMatches[0]!;
  }

  if (exactMatches.length > 1) {
    throw new CliError(
      `Multiple ${label}s match ${input}: ${exactMatches.map((item) => item.name).join(", ")}.`,
    );
  }

  const partialMatches = items.filter((item) =>
    item.name.toLowerCase().includes(normalizedInput),
  );

  if (partialMatches.length === 1) {
    return partialMatches[0]!;
  }

  if (partialMatches.length > 1) {
    throw new CliError(
      `Multiple ${label}s match ${input}: ${partialMatches
        .slice(0, 5)
        .map((item) => item.name)
        .join(", ")}.`,
    );
  }

  throw new CliError(`No ${label} matched ${input}.`);
}
