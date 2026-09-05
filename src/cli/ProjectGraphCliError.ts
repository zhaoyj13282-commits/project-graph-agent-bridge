export type CliErrorMetadata = { upstreamCode?: string; details?: unknown; exitCode?: number | null };

export class ProjectGraphCliError extends Error {
  readonly upstreamCode?: string;
  readonly details?: unknown;
  readonly exitCode?: number | null;

  constructor(
    readonly code: string,
    message: string,
    metadata: CliErrorMetadata = {},
  ) {
    super(message);
    this.name = 'ProjectGraphCliError';
    this.upstreamCode = metadata.upstreamCode;
    this.details = metadata.details;
    this.exitCode = metadata.exitCode;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      upstreamCode: this.upstreamCode,
      details: this.details,
      exitCode: this.exitCode,
    };
  }
}

export function processFailure(stderr: string, exitCode: number | null): ProjectGraphCliError {
  const candidates = [stderr.trim(), ...stderr.trim().split(/\r?\n/).reverse()];
  for (const candidate of candidates) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      'code' in value &&
      typeof value.code === 'string' &&
      'message' in value &&
      typeof value.message === 'string'
    ) {
      return new ProjectGraphCliError(value.code, value.message, {
        upstreamCode: value.code,
        details: 'details' in value ? value.details : undefined,
        exitCode,
      });
    }
  }
  return new ProjectGraphCliError(
    'CLI_PROCESS_FAILED',
    `Project Graph process failed (exit ${exitCode ?? 'signal'}).`,
    {
      exitCode,
      details: { stderr: stderr.trim() },
    },
  );
}
