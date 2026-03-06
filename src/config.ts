import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

import { getBooleanFlag, getOutputMode, getStringFlag } from "./flags";
import { CliError } from "./errors";
import type { CliFlags, ConfigLoadResult, RuntimeConfig, StoredConfig } from "./types";

export const DEFAULT_API_URL = "https://app.solidtime.io/api";

export function getConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfigHome && xdgConfigHome.length > 0
    ? xdgConfigHome
    : join(homedir(), ".config");

  return join(baseDir, "solidtime", "config.json");
}

export async function loadStoredConfig(): Promise<ConfigLoadResult> {
  const configPath = getConfigPath();
  const warnings: string[] = [];

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as StoredConfig;

    try {
      const fileStat = await stat(configPath);
      if ((fileStat.mode & 0o077) !== 0) {
        warnings.push(
          `Config file ${configPath} is readable by other users. Run chmod 600 ${configPath}.`,
        );
      }
    } catch {
      // Ignore permission checks when stat fails.
    }

    return { configPath, storedConfig: parsed, warnings };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return { configPath, storedConfig: null, warnings };
    }

    if (error instanceof SyntaxError) {
      throw new CliError(`Config file ${configPath} contains invalid JSON.`);
    }

    throw error;
  }
}

export function resolveRuntimeConfig(
  flags: CliFlags,
  loaded: ConfigLoadResult,
): RuntimeConfig {
  const stored = loaded.storedConfig ?? {};

  const apiUrl =
    getStringFlag(flags, "apiUrl") ??
    process.env.SOLIDTIME_API_URL ??
    stored.apiUrl ??
    DEFAULT_API_URL;

  const apiKey =
    getStringFlag(flags, "apiKey") ??
    process.env.SOLIDTIME_API_KEY ??
    stored.apiKey;

  const organizationId =
    getStringFlag(flags, "organizationId") ??
    getStringFlag(flags, "org") ??
    process.env.SOLIDTIME_ORG_ID ??
    stored.organizationId;

  const defaultBillable =
    getBooleanFlag(flags, "defaultBillable") ??
    parseOptionalBoolean(process.env.SOLIDTIME_DEFAULT_BILLABLE) ??
    stored.defaultBillable ??
    false;

  const output =
    getOutputMode(flags) ??
    parseOutputMode(process.env.SOLIDTIME_OUTPUT) ??
    stored.output ??
    "table";

  if (!apiKey) {
    throw new CliError(
      `No API key configured. Run \`solidtime init --api-key <token>\` or set SOLIDTIME_API_KEY.`,
    );
  }

  return {
    apiUrl,
    apiKey,
    organizationId,
    defaultBillable,
    output,
    configPath: loaded.configPath,
  };
}

export async function writeStoredConfig(config: StoredConfig): Promise<string> {
  const configPath = getConfigPath();
  const directoryPath = dirname(configPath);

  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  await chmod(directoryPath, 0o700).catch(() => undefined);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(configPath, 0o600).catch(() => undefined);

  return configPath;
}

export function redactApiKey(apiKey: string | undefined): string | undefined {
  if (!apiKey) {
    return undefined;
  }

  if (apiKey.length <= 8) {
    return "********";
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseOutputMode(value: string | undefined): "table" | "json" | undefined {
  if (value === "table" || value === "json") {
    return value;
  }

  return undefined;
}
