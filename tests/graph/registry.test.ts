import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ProjectRegistry } from '../../src/projects/ProjectRegistry.js';
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'prg-registry-'));
  dirs.push(dir);
  const root = join(dir, 'allowed');
  await mkdir(root);
  await writeFile(join(root, 'demo.prg'), 'opaque');
  return {
    dir,
    root,
    config: { allowedRoots: [root], projects: { demo: { path: join(root, 'demo.prg'), name: 'Demo' } } },
  };
}
test('aliases expose no paths and default to read only', async () => {
  const { config } = await setup();
  const registry = new ProjectRegistry(config);
  expect(registry.list()).toEqual([
    { id: 'demo', name: 'Demo', permissions: { read: true, write: false, destructive: false } },
  ]);
  expect(await registry.resolve('demo', 'read')).toMatch(/demo.prg$/);
  await expect(registry.resolve('demo', 'write')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await expect(registry.resolve('../demo', 'read')).rejects.toMatchObject({ code: 'PROJECT_NOT_REGISTERED' });
  await expect(registry.resolve('__proto__', 'read')).rejects.toMatchObject({
    code: 'PROJECT_NOT_REGISTERED',
  });
});
test('canonical roots reject traversal, prefix siblings, and symlink escapes', async () => {
  const { dir, root, config } = await setup();
  const outside = join(dir, 'allowed-evil');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.prg'), 'opaque');
  config.projects.demo.path = join(root, '..', 'allowed-evil', 'secret.prg');
  await expect(new ProjectRegistry(config).resolve('demo', 'read')).rejects.toMatchObject({
    code: 'PROJECT_OUTSIDE_ROOTS',
  });
  await symlink(outside, join(root, 'escape'), 'junction');
  config.projects.demo.path = join(root, 'escape', 'secret.prg');
  await expect(new ProjectRegistry(config).resolve('demo', 'read')).rejects.toMatchObject({
    code: 'PROJECT_OUTSIDE_ROOTS',
  });
});
test('rejects directories and non-PRG files', async () => {
  const { root, config } = await setup();
  config.projects.demo.path = root;
  await expect(new ProjectRegistry(config).resolve('demo', 'read')).rejects.toMatchObject({
    code: 'PROJECT_INVALID',
  });
});
