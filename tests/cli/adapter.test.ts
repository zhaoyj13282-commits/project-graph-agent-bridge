import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ProjectGraphCliAdapter } from '../../src/cli/ProjectGraphCliAdapter.js';

const fixture = fileURLToPath(new URL('../fixtures/cli-process.mjs', import.meta.url));
function adapter(mode = 'ok', options = {}) {
  return new ProjectGraphCliAdapter({ executable: process.execPath, prefixArgs: [fixture, mode], ...options });
}

describe('CLI subprocess boundary', () => {
  it('probes required tools using actual child processes', async () => {
    const result = await adapter().probe();
    expect(result.version).toBe('test-runtime-1');
    expect(result.tools.map(t => t.name)).toEqual(['get_all_nodes', 'create_text_node']);
  });
  it('passes paths and JSON as literal arguments and upgrades only on request', async () => {
    const project = 'D:/图 with spaces/a & b.prg';
    const input = { text: '你好 "quoted"\n$(secret) & | %PATH% `literal` \\end' };
    const result = await adapter().invoke<{ args: string[]; input: unknown }>('create_text_node', project, input);
    expect(result.input).toEqual(input);
    expect(result.args).toEqual(['tool', 'invoke', 'create_text_node', '--project', project, '--input', JSON.stringify(input)]);
    const upgraded = await adapter().invoke<{ args: string[] }>('create_text_node', project, input, { allowUpgrade: true });
    expect(upgraded.args.at(-1)).toBe('--allow-upgrade');
  });
  it('preserves upstream structured errors even with diagnostic stderr', async () => {
    await expect(adapter('error').invoke('edit_text_node', 'a.prg', {})).rejects.toMatchObject({
      code: 'STALE_REF', upstreamCode: 'STALE_REF', message: 'Reference expired', details: { ref: 'n9' }, exitCode: 1,
    });
  });
  it('retains unstructured error diagnostics and exit code', async () => {
    await expect(adapter('plain-error').listTools()).rejects.toMatchObject({ code: 'CLI_PROCESS_FAILED', exitCode: 7, details: { stderr: 'failure without JSON' } });
  });
  it('rejects malformed and empty outputs', async () => {
    await expect(adapter('malformed').listTools()).rejects.toMatchObject({ code: 'CLI_INVALID_OUTPUT' });
    await expect(adapter('empty').getVersion()).rejects.toMatchObject({ code: 'CLI_UNSUPPORTED' });
  });
  it('rejects missing required capabilities before mutations', async () => {
    await expect(adapter('missing').probe()).rejects.toMatchObject({ code: 'CLI_UNSUPPORTED', details: { missingTools: ['create_text_node'] } });
  });
  it('terminates a stalled subprocess at the timeout', async () => {
    await expect(adapter('hang', { timeoutMs: 250 }).getVersion()).rejects.toMatchObject({ code: 'CLI_TIMEOUT' });
  });
  it('cancels an in-flight operation', async () => {
    const controller = new AbortController();
    const promise = adapter('hang').invoke('get_all_nodes', 'a.prg', {}, { signal: controller.signal });
    const timer = setTimeout(() => controller.abort(), 150);
    try { await expect(promise).rejects.toMatchObject({ code: 'CANCELLED' }); } finally { clearTimeout(timer); }
  });
  it('does not launch with an already-aborted signal', async () => {
    await expect(adapter().invoke('get_all_nodes', 'a.prg', {}, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('bounds collected process output', async () => {
    await expect(adapter('overflow', { maxOutputBytes: 1024 }).listTools()).rejects.toMatchObject({ code: 'CLI_OUTPUT_LIMIT' });
  });
  it('reports a missing executable as a structured error', async () => {
    await expect(new ProjectGraphCliAdapter({ executable: 'missing-project-graph-xyz' }).getVersion()).rejects.toMatchObject({ code: 'CLI_NOT_FOUND' });
  });
  it('rejects non-JSON input before invoking the runtime', async () => {
    await expect(adapter().invoke('create_text_node', 'a.prg', undefined)).rejects.toMatchObject({ code: 'TOOL_INPUT_INVALID' });
  });
});
