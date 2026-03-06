export class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof CliError) {
    return error.message;
  }

  if (isObject(error) && "response" in error && isObject(error.response)) {
    const response = error.response as Record<string, unknown>;
    const status = typeof response.status === "number" ? response.status : undefined;
    const data = isObject(response.data) ? response.data : undefined;
    const message = extractApiMessage(data);

    if (status === 404 && message === "No message") {
      return "Resource not found.";
    }

    return status ? `API ${status}: ${message}` : message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}

export function isApiStatus(error: unknown, statusCode: number): boolean {
  if (!isObject(error) || !("response" in error) || !isObject(error.response)) {
    return false;
  }

  return error.response.status === statusCode;
}

function extractApiMessage(data: Record<string, unknown> | undefined): string {
  if (!data) {
    return "Request failed.";
  }

  const parts: string[] = [];

  if (typeof data.message === "string") {
    parts.push(data.message);
  }

  if (isObject(data.errors)) {
    for (const [field, value] of Object.entries(data.errors)) {
      if (!Array.isArray(value) || value.length === 0) {
        continue;
      }

      parts.push(`${field}: ${value.join(", ")}`);
    }
  }

  if (parts.length === 0) {
    return "No message";
  }

  return parts.join(" | ");
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
