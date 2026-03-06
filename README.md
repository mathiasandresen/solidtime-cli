# solidtime-cli

Timer-first CLI for `solidtime`, built on top of `@solidtime/api`.

## Install

```bash
bun install
```

## Configure

Create a config file in `~/.config/solidtime/config.json` or `${XDG_CONFIG_HOME}/solidtime/config.json`:

```bash
bun run index.ts init
```

`init` now runs an interactive setup flow in a TTY, validates your API URL and token together, and then writes the config file.

Optional flags:

```bash
bun run index.ts init \
  --api-key <token> \
  --organization-id <uuid> \
  --api-url https://app.solidtime.io/api \
  --default-billable false
```

If your token belongs to a self-hosted or custom solidtime instance, pass that instance explicitly, for example `--api-url https://time.example.com/api`.

Use `--no-interactive` when you want to script setup entirely from flags or environment variables.

Flags override environment variables, and environment variables override the config file.

## Commands

```bash
bun run index.ts whoami
bun run index.ts projects list
bun run index.ts tasks list --project "My Project"
bun run index.ts timer status
bun run index.ts timer start --description "CLI work" --project "My Project"
bun run index.ts timer stop
bun run index.ts entries list --from 2026-03-01T00:00:00Z --to 2026-03-07T00:00:00Z
bun run index.ts reports week
bun run index.ts reports week -1
```

Use `--json` on read commands when you want machine-readable output.
