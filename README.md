# solidtime-cli

`solidtime-cli` is a small Bun-powered CLI for `solidtime`.

It is built for the day-to-day stuff: starting a timer, checking what is running, stopping it, and looking up projects, tasks, entries, or a quick weekly snapshot without opening the app.

## Getting started

Install dependencies:

```bash
bun install
```

Then run the setup flow:

```bash
bun run index.ts init
```

That command walks you through the basics, checks that your API URL and token actually work together, and saves the config file to `~/.config/solidtime/config.json` or `${XDG_CONFIG_HOME}/solidtime/config.json`.

If you would rather script setup, you can pass everything up front:

```bash
bun run index.ts init \
  --api-key <token> \
  --organization-id <uuid> \
  --api-url https://app.solidtime.io/api \
  --default-billable false \
  --no-interactive
```

If you use a self-hosted solidtime instance, point the CLI at that API explicitly, for example `--api-url https://time.example.com/api`.

Flags win over environment variables, and environment variables win over the saved config file.
