import { spawn } from 'node:child_process';
import { z } from 'zod';
import { ProjectGraphCliError, processFailure } from './ProjectGraphCliError.js';
import {
  toolDefinitionSchema,
  type CliOptions,
  type InvokeOptions,
  type ProjectGraphToolDefinition,
  type UpstreamCapabilities,
} from './types.js';

/** Sole process boundary. Never parses PRG data or retries a mutation. */
export class ProjectGraphCliAdapter {
  private readonly options: Required<CliOptions>;

  constructor(options: CliOptions) {
    this.options = { timeoutMs: 15000, maxOutputBytes: 8 * 1024 * 1024, prefixArgs: [], ...options };
    if (
      !Number.isFinite(this.options.timeoutMs) ||
      this.options.timeoutMs <= 0 ||
      !Number.isSafeInteger(this.options.maxOutputBytes) ||
      this.options.maxOutputBytes <= 0
    ) {
      throw new ProjectGraphCliError(
        'CONFIG_INVALID',
        'Timeout and output limit must be positive finite values.',
      );
    }
  }

  private run(args: string[], signal?: AbortSignal): Promise<string> {
    if (signal?.aborted)
      return Promise.reject(new ProjectGraphCliError('CANCELLED', 'Operation cancelled before launch.'));
    return new Promise((resolve, reject) => {
      const child = spawn(this.options.executable, [...this.options.prefixArgs, ...args], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [],
        stderr: Buffer[] = [];
      let size = 0;
      let failure: ProjectGraphCliError | undefined;
      let settled = false;
      const stop = (error: ProjectGraphCliError) => {
        if (failure || settled) return;
        failure = error;
        child.kill('SIGKILL');
      };
      const abort = () =>
        stop(
          new ProjectGraphCliError(
            'CANCELLED',
            'Operation cancelled; re-inspect before retrying any mutation.',
          ),
        );
      const timer = setTimeout(
        () =>
          stop(
            new ProjectGraphCliError(
              'CLI_TIMEOUT',
              'Project Graph did not exit before the timeout. Check Tool CLI compatibility; mutation state may require re-inspection.',
            ),
          ),
        this.options.timeoutMs,
      );
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      const collect = (target: Buffer[], chunk: Buffer) => {
        if (failure) return;
        size += chunk.length;
        if (size > this.options.maxOutputBytes) {
          stop(
            new ProjectGraphCliError(
              'CLI_OUTPUT_LIMIT',
              'Project Graph exceeded the configured output limit.',
            ),
          );
        } else target.push(chunk);
      };
      child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
      child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
      child.on('error', (error: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          failure ??
            new ProjectGraphCliError(
              error.code === 'ENOENT' ? 'CLI_NOT_FOUND' : 'CLI_PROCESS_FAILED',
              'Could not launch Project Graph CLI.',
              { details: { systemCode: error.code } },
            ),
        );
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (failure) reject(failure);
        else if (code !== 0) reject(processFailure(Buffer.concat(stderr).toString('utf8'), code));
        else resolve(Buffer.concat(stdout).toString('utf8').trim());
      });
    });
  }

  private async json(args: string[], signal?: AbortSignal): Promise<unknown> {
    const output = await this.run(args, signal);
    try {
      return JSON.parse(output);
    } catch {
      throw new ProjectGraphCliError(
        'CLI_INVALID_OUTPUT',
        'Project Graph did not return valid JSON. Check that the configured program is the Tool CLI.',
      );
    }
  }

  async getVersion(): Promise<string> {
    const version = await this.run(['--version']);
    if (!version) throw new ProjectGraphCliError('CLI_UNSUPPORTED', 'Executable returned no CLI version.');
    return version;
  }

  async listTools(): Promise<ProjectGraphToolDefinition[]> {
    const result = z.array(toolDefinitionSchema).safeParse(await this.json(['tool', 'list']));
    if (!result.success)
      throw new ProjectGraphCliError(
        'CLI_UNSUPPORTED',
        'Tool list does not match the upstream CLI contract.',
        { details: result.error.issues },
      );
    return result.data;
  }

  async describeTool(name: string): Promise<ProjectGraphToolDefinition> {
    const result = toolDefinitionSchema.safeParse(await this.json(['tool', 'describe', name]));
    if (!result.success || result.data.name !== name)
      throw new ProjectGraphCliError(
        'CLI_UNSUPPORTED',
        'Tool description does not match the requested tool.',
      );
    return result.data;
  }

  async invoke<T = unknown>(
    tool: string,
    projectPath: string,
    input: unknown,
    options: InvokeOptions = {},
  ): Promise<T> {
    let json: string | undefined;
    try {
      json = JSON.stringify(input);
    } catch {
      /* normalized below */
    }
    if (json === undefined)
      throw new ProjectGraphCliError('TOOL_INPUT_INVALID', 'Tool input must be JSON serializable.');
    const args = ['tool', 'invoke', tool, '--project', projectPath, '--input', json];
    if (options.allowUpgrade) args.push('--allow-upgrade');
    return (await this.json(args, options.signal)) as T;
  }

  async probe(required = ['get_all_nodes', 'create_text_node']): Promise<UpstreamCapabilities> {
    const version = await this.getVersion();
    const entries = await this.listTools();
    const missingTools = required.filter((name) => !entries.some((entry) => entry.name === name));
    if (missingTools.length)
      throw new ProjectGraphCliError('CLI_UNSUPPORTED', 'Required upstream tools are missing.', {
        details: { missingTools },
      });
    const tools: ProjectGraphToolDefinition[] = [];
    for (const name of required) tools.push(await this.describeTool(name));
    return { version, tools };
  }
}
