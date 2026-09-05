import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const fixture = fileURLToPath(new URL('../fixtures/cli-process.mjs', import.meta.url));
it('emits one JSON capability result and no startup noise', () => {
  const result = spawnSync(process.execPath, [entry, 'probe'], { encoding: 'utf8', windowsHide: true,
    env: { ...process.env, PROJECT_GRAPH_CLI: process.execPath, PROJECT_GRAPH_CLI_ARGS: JSON.stringify([fixture, 'ok']) } });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({ version: 'test-runtime-1', tools: [{ name: 'get_all_nodes' }, { name: 'create_text_node' }] });
});
it('reports invalid local configuration as JSON with nonzero exit', () => {
  const result = spawnSync(process.execPath, [entry, 'probe'], { encoding: 'utf8', windowsHide: true,
    env: { ...process.env, PROJECT_GRAPH_CLI_ARGS: 'not json' } });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(JSON.parse(result.stderr)).toMatchObject({ code: 'CONFIG_INVALID' });
});
