import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import { CliError } from "./errors";

export function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptText(options: {
  label: string;
  defaultValue?: string;
  allowEmpty?: boolean;
  emptyValue?: string | undefined;
}): Promise<string | undefined> {
  const promptLabel = buildPromptLabel(options.label, options.defaultValue);

  while (true) {
    const answer = await ask(promptLabel);
    const trimmed = answer.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }

    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }

    if (options.allowEmpty) {
      return options.emptyValue;
    }

    console.log("A value is required.");
  }
}

export async function promptSecret(options: {
  label: string;
  currentValue?: string;
}): Promise<string> {
  const suffix = options.currentValue
    ? ` [press enter to keep ${maskValue(options.currentValue)}]`
    : "";

  while (true) {
    const answer = await askSecret(`${options.label}${suffix}: `);
    const trimmed = answer.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }

    if (options.currentValue) {
      return options.currentValue;
    }

    console.log("A value is required.");
  }
}

export async function promptConfirm(options: {
  label: string;
  defaultValue: boolean;
}): Promise<boolean> {
  const suffix = options.defaultValue ? "Y/n" : "y/N";

  while (true) {
    const answer = await ask(`${options.label} [${suffix}]: `);
    const trimmed = answer.trim().toLowerCase();

    if (trimmed.length === 0) {
      return options.defaultValue;
    }

    if (["y", "yes"].includes(trimmed)) {
      return true;
    }

    if (["n", "no"].includes(trimmed)) {
      return false;
    }

    console.log("Please answer yes or no.");
  }
}

export async function promptChoice<T extends string>(options: {
  label: string;
  choices: readonly T[];
  defaultValue: T;
}): Promise<T> {
  const choiceList = options.choices.join("/");

  while (true) {
    const answer = await ask(
      `${options.label} [${choiceList}] (${options.defaultValue}): `,
    );
    const trimmed = answer.trim().toLowerCase();

    if (trimmed.length === 0) {
      return options.defaultValue;
    }

    const match = options.choices.find((choice) => choice.toLowerCase() === trimmed);
    if (match) {
      return match;
    }

    console.log(`Choose one of: ${choiceList}.`);
  }
}

function buildPromptLabel(label: string, defaultValue: string | undefined): string {
  return defaultValue !== undefined ? `${label} (${defaultValue}): ` : `${label}: `;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  try {
    return await rl.question(question);
  } catch {
    throw new CliError("Interactive setup cancelled.", 1);
  } finally {
    rl.close();
  }
}

async function askSecret(question: string): Promise<string> {
  const mutedOutput = new MutableWritable(process.stdout);
  const rl = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
  });

  try {
    process.stdout.write(question);
    mutedOutput.muted = true;
    const answer = await rl.question("");
    mutedOutput.muted = false;
    process.stdout.write("\n");
    return answer;
  } catch {
    throw new CliError("Interactive setup cancelled.", 1);
  } finally {
    mutedOutput.muted = false;
    rl.close();
  }
}

function maskValue(value: string): string {
  return value.length <= 8 ? "********" : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

class MutableWritable extends Writable {
  muted = false;

  constructor(private readonly target: NodeJS.WriteStream) {
    super();
  }

  override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    if (!this.muted) {
      this.target.write(chunk, encoding);
    }

    callback();
  }
}
