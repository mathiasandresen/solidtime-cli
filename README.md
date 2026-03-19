# solidtime-cli

`solidtime-cli` is a small Bun-powered CLI for `solidtime`.

It is built for the day-to-day stuff: starting a timer, checking what is running, stopping it, and looking up projects, tasks, entries, or a quick weekly snapshot without opening the app.

## Getting started

Install the published package from npm:

```bash
npm install -g solidtime-cli
```

Or run the published package directly with `npx`:

```bash
npx solidtime-cli --help
```

The published package exposes the `solidtime` command:

```bash
solidtime --help
```

Install dependencies:

```bash
bun install
```

Then run the setup flow:

```bash
bun run index.ts init
```

If you install the published package globally, use the installed binary instead:

```bash
solidtime init
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

## Release flow

The npm package is published as `solidtime-cli`.

Publishing is handled by GitHub Actions when you push a version tag that matches `package.json`.

1. Update the version in `package.json`.
2. Commit the change.
3. Create and push a tag like `v0.1.0`.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow installs dependencies with Bun, typechecks, builds `dist/solidtime.js`, and publishes to npm.

To enable publishing, add an `NPM_TOKEN` repository secret with permission to publish `solidtime-cli`.
