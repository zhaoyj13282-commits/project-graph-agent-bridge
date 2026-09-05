import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';
import { ProjectGraphCliError } from './ProjectGraphCliError.js';

export type LocatorOptions = { env?: NodeJS.ProcessEnv; configuredPath?: string };

async function candidate(path: string): Promise<string | undefined> {
  try {
    if (!(await stat(path)).isFile()) return undefined;
    await access(path, process.platform === 'win32' ? constants.R_OK : constants.X_OK);
    return await realpath(path);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? ''))
      return undefined;
    throw error;
  }
}

function requireNative(path: string): string {
  if (['.cmd', '.bat', '.ps1'].includes(extname(path).toLowerCase())) {
    throw new ProjectGraphCliError(
      'CLI_UNSUPPORTED',
      'Shell launchers are unsupported. Configure a native executable, or Node with an explicit CLI entry point.',
    );
  }
  return path;
}

async function find(name: string, path: string): Promise<string | undefined> {
  if (isAbsolute(name) || name.includes('/') || name.includes('\\')) return candidate(name);
  const names = process.platform === 'win32' && !extname(name) ? [name + '.exe', name] : [name];
  for (const directory of path.split(delimiter).filter(Boolean)) {
    for (const file of names) {
      const result = await candidate(join(directory.replace(/^"|"$/g, ''), file));
      if (result) return result;
    }
  }
  return undefined;
}

export async function locateProjectGraphCli(options: LocatorOptions = {}): Promise<string> {
  const env = options.env ?? process.env;
  const path = env.PATH ?? env.Path ?? '';
  if (env.PROJECT_GRAPH_CLI?.trim()) {
    const result = await find(env.PROJECT_GRAPH_CLI.trim(), path);
    if (result) return requireNative(result);
    throw new ProjectGraphCliError(
      'CLI_NOT_FOUND',
      'PROJECT_GRAPH_CLI does not identify a readable executable.',
    );
  }
  const onPath = await find('project-graph', path);
  if (onPath) return requireNative(onPath);
  if (options.configuredPath) {
    const result = await find(options.configuredPath, path);
    if (result) return requireNative(result);
  }
  throw new ProjectGraphCliError(
    'CLI_NOT_FOUND',
    'Set PROJECT_GRAPH_CLI to a compatible Project Graph Tool CLI, or add it to PATH.',
  );
}
