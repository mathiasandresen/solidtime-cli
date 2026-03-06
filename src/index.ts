import {
  type ApplicationText,
  buildApplication,
  buildCommand,
  buildRouteMap,
  looseBooleanParser,
  run as runCli,
  text_en,
} from "@stricli/core";

import { createClient, type SolidTimeClient } from "./api";
import { handleConfigShow, handleInit } from "./commands/config";
import { handleEntriesList } from "./commands/entries";
import { handleProjectsList } from "./commands/projects";
import { handleReportsWeek } from "./commands/reports";
import { handleTasksList } from "./commands/tasks";
import { handleTimerStart, handleTimerStatus, handleTimerStop } from "./commands/timer";
import { handleWhoAmI } from "./commands/whoami";
import { loadStoredConfig, resolveRuntimeConfig } from "./config";
import { loadCommandContext } from "./context";
import { CliError, formatError } from "./errors";
import type { CliFlags, CommandContext, RuntimeConfig } from "./types";

import packageJson from "../package.json" with { type: "json" };

const VERSION = packageJson.version;

type SharedFlags = {
  apiKey?: string;
  apiUrl?: string;
  organizationId?: string;
  org?: string;
  output?: "table" | "json";
  json?: boolean;
};

interface InitFlags {
  apiKey?: string;
  apiUrl?: string;
  organizationId?: string;
  org?: string;
  defaultBillable?: boolean;
  output?: "table" | "json";
  json?: boolean;
  noInteractive?: boolean;
}

interface ProjectsListFlags extends SharedFlags {
  archived?: "false" | "true" | "all";
}

interface TasksListFlags extends SharedFlags {
  project?: string;
  done?: "false" | "true" | "all";
}

interface TimerStartFlags extends SharedFlags {
  description?: string;
  project?: string;
  task?: string;
  billable?: boolean;
  at?: string;
  tag?: string[];
  defaultBillable?: boolean;
}

interface TimerStopFlags extends SharedFlags {
  at?: string;
}

interface EntriesListFlags extends SharedFlags {
  from?: string;
  to?: string;
  active?: boolean;
  limit?: string;
}

interface ReportsWeekFlags extends SharedFlags {}

interface AppCommandContext {
  readonly process: typeof process;
  readonly commandContext?: CommandContext;
  readonly client?: SolidTimeClient;
}

const stringFlag = (brief: string) => ({
  kind: "parsed" as const,
  parse: String,
  brief,
  optional: true as const,
});

const booleanFlag = (brief: string) => ({
  kind: "boolean" as const,
  brief,
  optional: true as const,
});

const outputFlag = {
  kind: "enum" as const,
  values: ["table", "json"] as const,
  brief: "Output mode (table or json)",
  optional: true as const,
};

const triStateFlag = (brief: string) => ({
  kind: "enum" as const,
  values: ["false", "true", "all"] as const,
  brief,
  optional: true as const,
});

const sharedFlags = {
  apiKey: stringFlag("Override configured API key"),
  apiUrl: stringFlag("Override configured API URL"),
  organizationId: stringFlag("Override organization ID"),
  org: stringFlag("Alias for --organization-id"),
  output: outputFlag,
  json: booleanFlag("Shortcut for --output json"),
};

const initCommand = buildCommand<InitFlags, [], AppCommandContext>({
  docs: {
    brief: "Create or update local configuration",
  },
  parameters: {
    flags: {
      apiKey: stringFlag("Solidtime API key"),
      apiUrl: stringFlag("Solidtime API base URL"),
      organizationId: stringFlag("Default organization ID"),
      org: stringFlag("Alias for --organization-id"),
      defaultBillable: booleanFlag("Default billable flag for new timers"),
      output: outputFlag,
      json: booleanFlag("Shortcut for --output json"),
      noInteractive: booleanFlag("Disable interactive setup"),
    },
  },
  async func(flags) {
    await handleInit(flags);
  },
});

const configShowCommand = buildCommand<Pick<SharedFlags, "output" | "json">, [], AppCommandContext>({
  docs: {
    brief: "Show current configuration",
  },
  parameters: {
    flags: {
      output: outputFlag,
      json: booleanFlag("Shortcut for --output json"),
    },
  },
  async func(flags) {
    await handleConfigShow(flags);
  },
});

const whoamiCommand = buildCommand<SharedFlags, [], AppCommandContext>({
  docs: {
    brief: "Show current user and membership",
  },
  parameters: {
    flags: sharedFlags,
  },
  async func(flags) {
    await handleWhoAmI(flags, requireCommandContext(this));
  },
});

const projectsListCommand = buildCommand<ProjectsListFlags, [], AppCommandContext>({
  docs: {
    brief: "List projects",
  },
  parameters: {
    flags: {
      ...sharedFlags,
      archived: triStateFlag("Project archive state: false, true, or all"),
    },
  },
  async func(flags) {
    await handleProjectsList(flags, requireCommandContext(this), requireClient(this));
  },
});

const tasksListCommand = buildCommand<TasksListFlags, [], AppCommandContext>({
  docs: {
    brief: "List tasks",
  },
  parameters: {
    flags: {
      ...sharedFlags,
      project: stringFlag("Filter by project name or ID"),
      done: triStateFlag("Task completion state: false, true, or all"),
    },
  },
  async func(flags) {
    await handleTasksList(flags, requireCommandContext(this), requireClient(this));
  },
});

const timerStatusCommand = buildCommand<SharedFlags, [], AppCommandContext>({
  docs: {
    brief: "Show active timer",
  },
  parameters: {
    flags: sharedFlags,
  },
  async func(flags) {
    await handleTimerStatus(flags, requireCommandContext(this), requireClient(this));
  },
});

const timerStartCommand = buildCommand<TimerStartFlags, [], AppCommandContext>({
  docs: {
    brief: "Start a timer",
  },
  parameters: {
    flags: {
      ...sharedFlags,
      description: stringFlag("Timer description"),
      project: stringFlag("Project name or ID"),
      task: stringFlag("Task name or ID"),
      billable: booleanFlag("Whether the timer is billable"),
      at: stringFlag("Start timestamp"),
      tag: {
        kind: "parsed" as const,
        parse: String,
        brief: "Tag ID",
        optional: true as const,
        variadic: true as const,
      },
      defaultBillable: booleanFlag("Override default billable setting"),
    },
  },
  async func(flags) {
    await handleTimerStart(flags, requireCommandContext(this), requireClient(this));
  },
});

const timerStopCommand = buildCommand<TimerStopFlags, [], AppCommandContext>({
  docs: {
    brief: "Stop the active timer",
  },
  parameters: {
    flags: {
      ...sharedFlags,
      at: stringFlag("Stop timestamp"),
    },
  },
  async func(flags) {
    await handleTimerStop(flags, requireCommandContext(this), requireClient(this));
  },
});

const entriesListCommand = buildCommand<EntriesListFlags, [], AppCommandContext>({
  docs: {
    brief: "List time entries",
  },
  parameters: {
    flags: {
      ...sharedFlags,
      from: stringFlag("Filter entries from timestamp"),
      to: stringFlag("Filter entries to timestamp"),
      active: booleanFlag("Filter by active state"),
      limit: stringFlag("Maximum number of entries to return"),
    },
  },
  async func(flags) {
    await handleEntriesList(flags, requireCommandContext(this), requireClient(this));
  },
});

const reportsWeekCommand = buildCommand<ReportsWeekFlags, [string?], AppCommandContext>({
  docs: {
    brief: "Show weekly status",
  },
  parameters: {
    flags: sharedFlags,
    positional: {
      kind: "tuple",
      parameters: [
        {
          parse: String,
          brief: "Relative week offset, e.g. -1 for last week",
          placeholder: "offset",
          optional: true as const,
        },
      ],
    },
  },
  async func(flags, offset) {
    await handleReportsWeek(flags, requireCommandContext(this), requireClient(this), offset);
  },
});

const app = buildApplication(
  buildRouteMap({
    routes: {
      init: initCommand,
      config: buildRouteMap({
        routes: {
          show: configShowCommand,
        },
        docs: {
          brief: "Configuration commands",
        },
      }),
      whoami: whoamiCommand,
      projects: buildRouteMap({
        routes: {
          list: projectsListCommand,
        },
        docs: {
          brief: "Project commands",
        },
      }),
      tasks: buildRouteMap({
        routes: {
          list: tasksListCommand,
        },
        docs: {
          brief: "Task commands",
        },
      }),
      timer: buildRouteMap({
        routes: {
          status: timerStatusCommand,
          start: timerStartCommand,
          stop: timerStopCommand,
        },
        docs: {
          brief: "Timer commands",
        },
      }),
      entries: buildRouteMap({
        routes: {
          list: entriesListCommand,
        },
        docs: {
          brief: "Time entry commands",
        },
      }),
      reports: buildRouteMap({
        routes: {
          week: reportsWeekCommand,
        },
        docs: {
          brief: "Reporting commands",
        },
      }),
    },
    docs: {
      brief: packageJson.description,
      fullDescription: [
        "Timer-first CLI for solidtime.",
        "",
        "Examples:",
        "  solidtime whoami",
        "  solidtime timer --help",
        '  solidtime timer start --description "CLI work"',
      ].join("\n"),
    },
  }),
  {
    name: "solidtime",
    versionInfo: {
      currentVersion: VERSION,
    },
    scanner: {
      caseStyle: "allow-kebab-for-camel",
    },
    determineExitCode(error) {
      return error instanceof CliError ? error.exitCode : 1;
    },
    localization: {
      defaultLocale: "en",
      loadText: () => createApplicationText(),
    },
  },
);

export async function run(argv: string[]) {
  await runCli(app, argv, {
    process,
    forCommand: async () => loadExecutionContext(),
  });
}

async function loadExecutionContext(): Promise<AppCommandContext> {
  const loadedConfig = await loadStoredConfig();
  const runtimeConfig = resolveRuntimeConfig(readRuntimeFlags(), loadedConfig);

  for (const warning of loadedConfig.warnings) {
    console.warn(`warning: ${warning}`);
  }

  const client = createClient(runtimeConfig);
  const commandContext = await loadCommandContext(client, runtimeConfig);

  return {
    process,
    client,
    commandContext,
  };
}

function readRuntimeFlags(): CliFlags {
  const flags: Record<string, unknown> = {};
  const inputs = Bun.argv.slice(2);

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!input || !input.startsWith("--")) {
      continue;
    }

    if (input === "--") {
      break;
    }

    const [rawName, explicitValue] = input.slice(2).split("=", 2);
    if (!rawName) {
      continue;
    }

    if (rawName === "json") {
      flags.json = true;
      continue;
    }

    if (rawName.startsWith("no-")) {
      flags[toCamelCase(rawName.slice(3))] = false;
      continue;
    }

    const name = toCamelCase(rawName);
    const next = explicitValue ?? inputs[index + 1];
    const hasValue = explicitValue !== undefined || (next !== undefined && !next.startsWith("-"));

    if (!hasValue) {
      flags[name] = true;
      continue;
    }

    const value = explicitValue ?? next;
    if (explicitValue === undefined) {
      index += 1;
    }

    if (name === "tag") {
      const existing = flags.tag;
      flags.tag = Array.isArray(existing) ? [...existing, value] : [value];
      continue;
    }

    flags[name] = parseFlagValue(name, value ?? "");
  }

  return flags;
}

function parseFlagValue(name: string, value: string): unknown {
  if (["json", "billable", "defaultBillable", "active", "noInteractive"].includes(name)) {
    return looseBooleanParser(value);
  }

  return value;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function requireCommandContext(context: AppCommandContext): CommandContext {
  if (!context.commandContext) {
    throw new CliError("Failed to load command context.");
  }

  return context.commandContext;
}

function requireClient(context: AppCommandContext): SolidTimeClient {
  if (!context.client) {
    throw new CliError("Failed to create API client.");
  }

  return context.client;
}

function createApplicationText(): ApplicationText {
  return {
    ...text_en,
    exceptionWhileRunningCommand(error, ansiColor) {
      const message = formatError(error);
      return ansiColor ? `\x1B[1m\x1B[31m${message}\x1B[39m\x1B[22m` : message;
    },
    commandErrorResult(error, ansiColor) {
      const message = formatError(error);
      return ansiColor ? `\x1B[1m\x1B[31m${message}\x1B[39m\x1B[22m` : message;
    },
  };
}
