import { getBooleanFlag, getOutputMode, getStringFlag, hasFlag } from "../flags";
import { validateCredentials } from "../api";
import { DEFAULT_API_URL, loadStoredConfig, redactApiKey, writeStoredConfig } from "../config";
import { CliError, isApiStatus } from "../errors";
import { printJson, printKeyValue } from "../output";
import { isInteractiveSession, promptChoice, promptConfirm, promptSecret, promptText } from "../prompt";
import type { CliFlags, StoredConfig } from "../types";

export async function handleInit(flags: CliFlags) {
  const existing = await loadStoredConfig();
  const current = existing.storedConfig ?? {};

  const interactive = isInteractiveSession() && !hasFlag(flags, "noInteractive");

  let apiUrl =
    getStringFlag(flags, "apiUrl") ??
    process.env.SOLIDTIME_API_URL ??
    current.apiUrl ??
    DEFAULT_API_URL;

  let apiKey =
    getStringFlag(flags, "apiKey") ?? process.env.SOLIDTIME_API_KEY ?? current.apiKey;

  if (interactive) {
    console.log("Solidtime setup");
    console.log(`Config file: ${existing.configPath}`);
    console.log("Press enter to accept defaults.");

    while (true) {
      apiUrl = (await promptText({
        label: "API URL",
        defaultValue: apiUrl,
      })) ?? DEFAULT_API_URL;

      apiKey = await promptSecret({
        label: "API key",
        currentValue: apiKey,
      });

      try {
        await validateCredentials(apiUrl, apiKey);
        break;
      } catch (error) {
        if (!isApiStatus(error, 401)) {
          throw error;
        }

        const hint = apiUrl === DEFAULT_API_URL
          ? "This token may belong to a different solidtime instance. Try the full API URL for your server."
          : "That API URL and token did not authenticate together. Check the instance URL and token, then try again.";

        console.log(`Authentication failed for ${apiUrl}. ${hint}`);
      }
    }
  } else {
    if (!apiKey) {
      throw new CliError("Missing API key. Pass --api-key, set SOLIDTIME_API_KEY, or run init in a TTY.");
    }

    try {
      await validateCredentials(apiUrl, apiKey);
    } catch (error) {
      if (isApiStatus(error, 401)) {
        const hint = apiUrl === DEFAULT_API_URL
          ? " This token may belong to a different solidtime instance. Re-run init with --api-url <your-instance>/api."
          : " Check that --api-url points at the correct solidtime instance and that the token is valid there.";

        throw new CliError(`Authentication failed for ${apiUrl}.${hint}`);
      }

      throw error;
    }
  }

  const organizationIdDefault =
    getStringFlag(flags, "organizationId") ??
    getStringFlag(flags, "org") ??
    process.env.SOLIDTIME_ORG_ID ??
    current.organizationId;

  const defaultBillableDefault =
    getBooleanFlag(flags, "defaultBillable") ??
    current.defaultBillable ??
    false;

  const outputDefault = getOutputMode(flags) ?? current.output ?? "table";

  const organizationId = interactive
    ? await promptText({
        label: "Default organization ID",
        defaultValue: organizationIdDefault,
        allowEmpty: true,
      })
    : organizationIdDefault;

  const defaultBillable = interactive
    ? await promptConfirm({
        label: "Default new timers to billable",
        defaultValue: defaultBillableDefault,
      })
    : defaultBillableDefault;

  const output = interactive
    ? await promptChoice({
        label: "Default output mode",
        choices: ["table", "json"] as const,
        defaultValue: outputDefault,
      })
    : outputDefault;

  const nextConfig: StoredConfig = {
    apiUrl,
    apiKey,
    organizationId,
    defaultBillable,
    output,
  };

  const configPath = await writeStoredConfig(nextConfig);

  console.log(`Saved config to ${configPath}`);
  console.log(`API URL: ${nextConfig.apiUrl}`);
  console.log(`API key: ${redactApiKey(nextConfig.apiKey)}`);
  if (nextConfig.organizationId) {
    console.log(`Default org: ${nextConfig.organizationId}`);
  }
}

export async function handleConfigShow(flags: CliFlags) {
  const loaded = await loadStoredConfig();

  if (!loaded.storedConfig) {
    throw new CliError(`No config found at ${loaded.configPath}. Run \`solidtime init\`.`);
  }

  const output = {
    path: loaded.configPath,
    config: {
      ...loaded.storedConfig,
      apiKey: redactApiKey(loaded.storedConfig.apiKey),
    },
    warnings: loaded.warnings,
  };

  if ((getOutputMode(flags) ?? loaded.storedConfig.output) === "json") {
    printJson(output);
    return;
  }

  printKeyValue([
    ["path", output.path],
    ["apiUrl", output.config.apiUrl],
    ["apiKey", output.config.apiKey],
    ["organizationId", output.config.organizationId],
    ["defaultBillable", output.config.defaultBillable],
    ["output", output.config.output],
  ]);

  for (const warning of output.warnings) {
    console.warn(`warning: ${warning}`);
  }
}
