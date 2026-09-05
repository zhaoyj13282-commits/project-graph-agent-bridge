import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { ProjectGraphCliError } from '../cli/ProjectGraphCliError.js';
export const projectSchema = z.strictObject({
  path: z.string().min(1),
  name: z.string().optional(),
  permissions: z
    .strictObject({
      read: z.boolean().default(true),
      write: z.boolean().default(false),
      destructive: z.boolean().default(false),
    })
    .prefault({}),
});
export const registrySchema = z.strictObject({
  allowedRoots: z.array(z.string().min(1)).min(1),
  projects: z.record(z.string().regex(/^[a-zA-Z0-9_-]+$/), projectSchema),
});
export const configSchema = registrySchema.extend({
  desktop: z.strictObject({ executable: z.string().min(1) }).optional(),
  cli: z.strictObject({
    executable: z.string().min(1),
    prefixArgs: z.array(z.string()).default([]),
    timeoutMs: z.number().int().positive().default(60000),
  }),
});
export type RegistryConfig = z.input<typeof registrySchema>;
export async function loadConfig(path: string) {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new ProjectGraphCliError('CONFIG_INVALID', 'Cannot read bridge config JSON.');
  }
  const parsed = configSchema.safeParse(value);
  if (!parsed.success)
    throw new ProjectGraphCliError('CONFIG_INVALID', 'Invalid bridge config.', {
      details: parsed.error.issues,
    });
  const config = parsed.data,
    base = dirname(resolve(path));
  config.allowedRoots = config.allowedRoots.map((root) => resolve(base, root));
  for (const project of Object.values(config.projects)) project.path = resolve(base, project.path);
  config.cli.executable = resolve(base, config.cli.executable);
  if (config.desktop) config.desktop.executable = resolve(base, config.desktop.executable);
  return config;
}
