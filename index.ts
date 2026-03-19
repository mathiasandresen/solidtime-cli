#!/usr/bin/env node

import { run } from "./src/index";

await run(process.argv.slice(2));
