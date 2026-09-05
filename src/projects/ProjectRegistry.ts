import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative } from 'node:path';
import { ProjectGraphCliError } from '../cli/ProjectGraphCliError.js';
import { registrySchema, type RegistryConfig } from './config.js';
export type Permission = 'read' | 'write' | 'destructive';
export class ProjectRegistry {
  private readonly config;
  constructor(config: RegistryConfig) {
    this.config = registrySchema.parse(config);
  }
  list() {
    return Object.entries(this.config.projects)
      .filter(([, p]) => p.permissions.read)
      .map(([id, p]) => ({ id, name: p.name ?? id, permissions: p.permissions }));
  }
  async resolve(alias: string, permission: Permission): Promise<string> {
    const project = Object.hasOwn(this.config.projects, alias) ? this.config.projects[alias] : undefined;
    if (!project)
      throw new ProjectGraphCliError(
        'PROJECT_NOT_REGISTERED',
        'Unknown project alias. Call prg_list_projects.',
      );
    if (
      !project.permissions.read ||
      (permission !== 'read' && !project.permissions.write) ||
      !project.permissions[permission]
    )
      throw new ProjectGraphCliError('PERMISSION_DENIED', `Project does not allow ${permission} operations.`);
    let path: string;
    try {
      path = await realpath(project.path);
    } catch {
      throw new ProjectGraphCliError('PROJECT_NOT_FOUND', 'Configured project is unavailable.');
    }
    if (extname(path).toLowerCase() !== '.prg' || !(await stat(path)).isFile())
      throw new ProjectGraphCliError('PROJECT_INVALID', 'Project must be an existing .prg file.');
    const roots = await Promise.all(this.config.allowedRoots.map((root) => realpath(root)));
    if (
      !roots.some((root) => {
        const rel = relative(root, path);
        return (
          rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../')
        );
      })
    )
      throw new ProjectGraphCliError(
        'PROJECT_OUTSIDE_ROOTS',
        'Configured project resolves outside allowed roots.',
      );
    return path;
  }
}
