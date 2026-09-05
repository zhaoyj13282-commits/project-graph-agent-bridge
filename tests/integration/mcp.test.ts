import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../../src/projects/config.js';
const object = z
  .object({
    ref: z.string(),
    type: z.string(),
    text: z.string().optional(),
    sourceRef: z.string().optional(),
    targetRef: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .passthrough();
const snapshot = z.object({ objects: z.array(object), total: z.number() });
const mutation = z.object({
  success: z.literal(true),
  verified: z.literal(true),
  objects: z.array(object),
  removedRefs: z.array(z.string()),
  upstream: z.unknown(),
});
test('real stdio MCP graph loop: list, inspect, create, edit, connect, layout, delete', async () => {
  await writeFile(
    resolve('docs/evidence/m1.local.json'),
    JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }),
  );
  const configPath = process.env.PROJECT_GRAPH_BRIDGE_TEST_CONFIG;
  if (!configPath)
    throw new Error(
      'Set PROJECT_GRAPH_BRIDGE_TEST_CONFIG to an operator config with a disposable, open demo alias.',
    );
  const config = await loadConfig(configPath);
  const path = await realpath(config.projects.demo!.path);
  const root = await realpath(resolve('.bridge-data'));
  const local = relative(root, path);
  if (isAbsolute(local) || local === '..' || local.startsWith('..\\') || local.startsWith('../'))
    throw new Error('Integration mutations are limited to .bridge-data test files.');
  const original = resolve('tests/fixtures/public.prg');
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const originalHash = hash(await readFile(original));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/index.js'), 'mcp', 'stdio', '--config', resolve(configPath)],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: 'real-bridge-acceptance', version: '1.0.0' });
  const events: unknown[] = [];

  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
    events.push({ name, result });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.structuredContent;
  }
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(7);
    expect(await call('prg_list_projects', {})).toMatchObject({
      projects: expect.arrayContaining([expect.objectContaining({ id: 'demo' })]),
    });
    const before = snapshot.parse(await call('prg_inspect', { project: 'demo' }));
    const marker = `MCP 验收 ${randomUUID()}`;
    const a = mutation.parse(
      await call('prg_create', {
        project: 'demo',
        text: marker + ' A',
        width: 320,
        sizeAdjust: 'manual',
        color: [100, 200, 150, 1],
      }),
    );
    const aRef = z.object({ ref: z.string() }).parse(a.upstream).ref;
    const b = mutation.parse(await call('prg_create', { project: 'demo', text: marker + ' B' }));
    const bRef = z.object({ ref: z.string() }).parse(b.upstream).ref;
    const edit = mutation.parse(
      await call('prg_edit', {
        project: 'demo',
        ref: aRef,
        data: { text: marker + ' edited', color: [80, 160, 240, 1], width: 300, sizeAdjust: 'manual' },
      }),
    );
    expect(edit.objects.find((o) => o.ref === aRef)?.text).toBe(marker + ' edited');
    const connect = mutation.parse(
      await call('prg_connect', {
        project: 'demo',
        edges: [{ sourceRef: aRef, targetRef: bRef, text: '验收依赖' }],
      }),
    );
    expect(
      connect.objects.some((o) => o.sourceRef === aRef && o.targetRef === bRef && o.text === '验收依赖'),
    ).toBe(true);
    const layout = mutation.parse(await call('prg_layout', { project: 'demo', refs: [aRef, bRef] }));
    const posA = layout.objects.find((o) => o.ref === aRef)!.position!;
    const posB = layout.objects.find((o) => o.ref === bRef)!.position!;
    expect(posB.x).toBeGreaterThan(posA.x);
    const focus = snapshot.parse(await call('prg_inspect', { project: 'demo', focusRef: aRef, depth: 1 }));
    expect(focus.total).toBe(3);
    const deleted = mutation.parse(await call('prg_delete', { project: 'demo', refs: [aRef, bRef] }));
    expect(deleted.removedRefs).toEqual(expect.arrayContaining([aRef, bRef]));
    const after = snapshot.parse(await call('prg_inspect', { project: 'demo' }));
    expect(after.total).toBe(before.total);
    const denied = await client.callTool({
      name: 'prg_delete',
      arguments: { project: 'example-readonly', refs: ['n1'] },
    });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent).toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
    expect(stderr).toBe('');
    expect(hash(await readFile(original))).toBe(originalHash);
    await writeFile(
      resolve('docs/evidence/m1.local.json'),
      JSON.stringify(
        { status: 'passed', beforeCount: before.total, afterCount: after.total, originalHash, events },
        null,
        2,
      ),
    );
  } catch (error) {
    await writeFile(
      resolve('docs/evidence/m1.local.json'),
      JSON.stringify({ status: 'failed', error: String(error), events }, null, 2),
    );
    throw error;
  } finally {
    await client.close();
    expect(hash(await readFile(original))).toBe(originalHash);
  }
}, 300000);
