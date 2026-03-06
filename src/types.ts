import type {
  Client,
  Member,
  MyMembership,
  Project,
  Task,
  TimeEntry,
} from "@solidtime/api";

export type OutputMode = "table" | "json";

export type CliFlags = object;

export interface StoredConfig {
  apiUrl?: string;
  apiKey?: string;
  organizationId?: string;
  defaultBillable?: boolean;
  output?: OutputMode;
}

export interface RuntimeConfig {
  apiUrl: string;
  apiKey: string;
  organizationId?: string;
  defaultBillable: boolean;
  output: OutputMode;
  configPath: string;
}

export interface ConfigLoadResult {
  configPath: string;
  storedConfig: StoredConfig | null;
  warnings: string[];
}

export interface CommandContext {
  config: RuntimeConfig;
  membership: MyMembership;
  member: Member;
  me: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    week_start: string;
  };
}

export interface TimerStatus {
  entry: TimeEntry | null;
  project: Project | null;
  task: Task | null;
}

export interface ResolvedProjectTask {
  project: Project | null;
  task: Task | null;
}

export interface TableRow {
  [key: string]: string | number | boolean | null | undefined;
}
