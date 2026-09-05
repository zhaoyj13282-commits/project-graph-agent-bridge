import { copyFile, mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { expect, it } from 'vitest';
import { ProjectGraphCliAdapter } from '../../src/cli/ProjectGraphCliAdapter.js';
import { locateProjectGraphCli } from '../../src/cli/ProjectGraphCliLocator.js';

const snapshotSchema = z.object({
  objects: z.array(
    z
      .object({
        ref: z.string().regex(/^[ne][1-9]\d*$/),
        type: z.string(),
        text: z.string().optional(),
      })
      .passthrough(),
  ),
});
const createdSchema = z.object({ success: z.literal(true), ref: z.string().regex(/^n[1-9]\d*$/) });

it('real PRG: get/create/get, GUI save, then closed-project disk read', async () => {
  expect(process.env.PROJECT_GRAPH_CLI, 'Set PROJECT_GRAPH_CLI to the real upstream Tool CLI').toBeTruthy();
  const executable = await locateProjectGraphCli();
  const prefixArgs = z.array(z.string()).parse(JSON.parse(process.env.PROJECT_GRAPH_CLI_ARGS ?? '[]'));
  const adapter = new ProjectGraphCliAdapter({
    executable,
    prefixArgs,
    timeoutMs: Number(process.env.PROJECT_GRAPH_TIMEOUT_MS ?? 60000),
  });
  const capabilities = await adapter.probe();
  const definition = capabilities.tools.find((tool) => tool.name === 'create_text_node')!;
  const properties = definition.inputSchema.properties as Record<string, { type?: string }> | undefined;
  expect(properties?.text?.type).toBe('string');
  expect(((definition.inputSchema.required ?? []) as string[]).filter((name) => name !== 'text')).toEqual([]);

  const fixture = await realpath(
    resolve(process.env.PROJECT_GRAPH_TEST_FIXTURE ?? 'tests/fixtures/public.prg'),
  );
  const original = await readFile(fixture);
  const temporary = await mkdtemp(join(tmpdir(), 'prg-bridge-integration-'));
  const openProject = process.env.PROJECT_GRAPH_TEST_OPEN_PROJECT;
  expect(
    openProject,
    'This upstream requires a matching Open Project for create_text_node; open a disposable .bridge-data copy first.',
  ).toBeTruthy();
  const project = await realpath(resolve(openProject!));
  const boundary = relative(await realpath('.bridge-data'), project);
  expect(
    boundary &&
      boundary !== '..' &&
      !boundary.startsWith('..\\') &&
      !boundary.startsWith('../') &&
      !isAbsolute(boundary),
    'Only disposable files inside .bridge-data may be mutated by this test',
  ).toBeTruthy();
  expect(project).not.toBe(fixture);
  const diskBefore = await readFile(project);
  const marker = `Bridge M0 验证 ${randomUUID()}`;
  try {
    const before = snapshotSchema.parse(await adapter.invoke('get_all_nodes', project, {}));
    const created = createdSchema.parse(await adapter.invoke('create_text_node', project, { text: marker }));
    const after = snapshotSchema.parse(await adapter.invoke('get_all_nodes', project, {}));
    expect(before.objects.some((object) => object.ref === created.ref)).toBe(false);
    expect(after.objects.filter((object) => object.ref === created.ref)).toEqual([
      expect.objectContaining({ ref: created.ref, type: 'TextNode', text: marker }),
    ]);
    expect(after.objects).toHaveLength(before.objects.length + 1);

    // Only the native GUI saves an Open Project; graph mutation above is exclusively CLI.
    const playwrightCli = resolve(
      process.env.PROJECT_GRAPH_PLAYWRIGHT_CLI ?? 'node_modules/@playwright/cli/playwright-cli.js',
    );
    const ui = promisify(execFile);
    await ui(
      process.execPath,
      [playwrightCli, '-s=' + (process.env.PROJECT_GRAPH_GUI_SESSION ?? 'prg-bridge'), 'press', 'Escape'],
      { windowsHide: true },
    );
    await ui(
      process.execPath,
      [playwrightCli, '-s=' + (process.env.PROJECT_GRAPH_GUI_SESSION ?? 'prg-bridge'), 'press', 'Control+s'],
      { windowsHide: true },
    );
    for (let attempt = 0; attempt < 100 && (await readFile(project)).equals(diskBefore); attempt++)
      await delay(100);
    expect(await readFile(project)).not.toEqual(diskBefore);
    const diskCopy = join(temporary, 'saved-copy.prg');
    await copyFile(project, diskCopy);
    const persisted = snapshotSchema.parse(await adapter.invoke('get_all_nodes', diskCopy, {}));
    expect(persisted.objects.filter((object) => object.text === marker)).toHaveLength(1);
    expect(persisted.objects).toHaveLength(after.objects.length);
    expect(await readFile(fixture)).toEqual(original);
    await writeFile(
      join(temporary, 'evidence.json'),
      JSON.stringify(
        {
          status: 'passed',
          version: capabilities.version,
          createdRef: created.ref,
          beforeCount: before.objects.length,
          afterCount: after.objects.length,
          persistedCount: persisted.objects.length,
          fixtureSha256: createHash('sha256').update(original).digest('hex'),
        },
        null,
        2,
      ),
    );
  } finally {
    expect(await readFile(fixture)).toEqual(original);
    console.info(`Integration evidence retained: ${temporary}`);
  }
}, 240000);
