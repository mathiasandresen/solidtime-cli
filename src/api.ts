import {
  createApiClient,
  type AggregatedTimeEntries,
  type AggregatedTimeEntriesQueryParams,
  type Member,
  type Project,
  type Task,
} from "@solidtime/api";
import { headerPlugin } from "@zodios/core";

import type { RuntimeConfig } from "./types";

export type SolidTimeClient = ReturnType<typeof createApiClient>;

export function createClient(config: RuntimeConfig): SolidTimeClient {
  const client = createApiClient(config.apiUrl);
  client.use(headerPlugin("Authorization", `Bearer ${config.apiKey}`));
  return client;
}

export async function validateCredentials(apiUrl: string, apiKey: string) {
  const client = createApiClient(apiUrl);
  client.use(headerPlugin("Authorization", `Bearer ${apiKey}`));
  return client.getMe();
}

export async function listAllMembers(
  client: SolidTimeClient,
  organizationId: string,
): Promise<Member[]> {
  const response = await client.getMembers({ params: { organization: organizationId } });
  return response.data;
}

export async function listAllProjects(
  client: SolidTimeClient,
  organizationId: string,
  archived: "true" | "false" | "all" = "false",
): Promise<Project[]> {
  return paginate(async (page) =>
    client.getProjects({
      params: { organization: organizationId },
      queries: { page, archived },
    }),
  );
}

export async function listAllTasks(
  client: SolidTimeClient,
  organizationId: string,
  options: { projectId?: string; done?: "true" | "false" | "all" } = {},
): Promise<Task[]> {
  const response = await client.getTasks({
    params: {
      organization: organizationId,
    },
    queries: {
      project_id: options.projectId,
      done: options.done ?? "false",
    },
  });

  return response.data;
}

export async function getAggregatedTimeEntries(
  client: SolidTimeClient,
  organizationId: string,
  queries: AggregatedTimeEntriesQueryParams,
): Promise<AggregatedTimeEntries> {
  const response = await client.getAggregatedTimeEntries({
    params: {
      organization: organizationId,
    },
    queries,
  });

  return response.data;
}

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    current_page?: number;
    last_page?: number;
  };
};

async function paginate<T>(
  getPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await getPage(page);
    items.push(...response.data);
    lastPage = response.meta.last_page ?? page;
    page += 1;
  } while (page <= lastPage);

  return items;
}
