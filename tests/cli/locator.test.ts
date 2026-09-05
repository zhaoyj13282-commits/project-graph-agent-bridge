import { mkdtemp, writeFile, chmod, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { locateProjectGraphCli } from '../../src/cli/ProjectGraphCliLocator.js';

const dirs: string[] = [];
async function executable(name: string) {
  const dir = await mkdtemp(join(tmpdir(), 'prg-locator-')); dirs.push(dir);
  const file = join(dir, name); await writeFile(file, 'fixture'); await chmod(file, 0o755);
  return { dir, file: await realpath(file) };
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
it('prefers an explicit environment path over PATH and config', async () => {
  const explicit = await executable('chosen.exe');
  expect(await locateProjectGraphCli({ env: { PROJECT_GRAPH_CLI: explicit.file, PATH: '' }, configuredPath: 'missing' })).toBe(explicit.file);
});
it('finds the official executable on PATH', async () => {
  const entry = await executable(process.platform === 'win32' ? 'project-graph.exe' : 'project-graph');
  expect(await locateProjectGraphCli({ env: { PATH: entry.dir } })).toBe(entry.file);
});
it('uses configured fallback when PATH has no candidate', async () => {
  const entry = await executable('custom.exe');
  expect(await locateProjectGraphCli({ env: { PATH: '' }, configuredPath: entry.file })).toBe(entry.file);
});
it('fails rather than silently falling back from an invalid explicit override', async () => {
  const entry = await executable('custom.exe');
  await expect(locateProjectGraphCli({ env: { PATH: '', PROJECT_GRAPH_CLI: join(entry.dir, 'missing') }, configuredPath: entry.file })).rejects.toMatchObject({ code: 'CLI_NOT_FOUND' });
});
it('rejects directories and shell launchers', async () => {
  const entry = await executable('project-graph.cmd');
  await expect(locateProjectGraphCli({ env: { PATH: '', PROJECT_GRAPH_CLI: entry.dir } })).rejects.toMatchObject({ code: 'CLI_NOT_FOUND' });
  await expect(locateProjectGraphCli({ env: { PATH: '', PROJECT_GRAPH_CLI: entry.file } })).rejects.toMatchObject({ code: 'CLI_UNSUPPORTED' });
});
