import { expect, test, vi } from 'vitest';
import { GraphService } from '../../src/graph/GraphService.js';
const objects = [
  { ref: 'n1', type: 'TextNode', text: 'A' },
  { ref: 'n2', type: 'TextNode', text: 'B' },
  { ref: 'e1', type: 'Edge', sourceRef: 'n1', targetRef: 'n2', text: '' },
];
function setup(responses: unknown[] = [{ objects }]) {
  const invoke = vi.fn();
  for (const result of responses) invoke.mockResolvedValueOnce(result);
  const resolve = vi.fn().mockResolvedValue('opaque.prg');
  return {
    invoke,
    resolve,
    service: new GraphService({ invoke } as never, { resolve, list: () => [] } as never),
  };
}
test('unknown refs return a fresh snapshot without sending a mutation', async () => {
  const { service, invoke } = setup();
  await expect(
    service.call('prg_edit', { project: 'demo', ref: 'n999', data: { text: 'bad' } }),
  ).rejects.toMatchObject({ code: 'UNKNOWN_REF', details: { snapshot: { objects } } });
  expect(invoke).toHaveBeenCalledTimes(1);
});
test('success:false preserves upstream code and refreshes state', async () => {
  const { service, invoke } = setup([
    { objects },
    { success: false, error: { code: 'wrong_node_type', ref: 'n1' } },
    { objects },
  ]);
  await expect(
    service.call('prg_edit', { project: 'demo', ref: 'n1', data: { text: 'X' } }),
  ).rejects.toMatchObject({
    code: 'wrong_node_type',
    upstreamCode: 'wrong_node_type',
    details: { snapshot: { objects } },
  });
  expect(invoke).toHaveBeenCalledTimes(3);
});
test('a reported success must be visible on re-read', async () => {
  const { service } = setup([{ objects }, { success: true, ref: 'n3' }, { objects }]);
  await expect(service.call('prg_create', { project: 'demo', text: 'X' })).rejects.toMatchObject({
    code: 'MUTATION_VERIFICATION_FAILED',
  });
});
test('partial connect failure is an error with complete upstream results and fresh state', async () => {
  const results = [
    { success: true, edgeRef: 'e2' },
    { success: false, error: 'bad edge' },
  ];
  const { service } = setup([{ objects }, results, { objects }]);
  await expect(
    service.call('prg_connect', { project: 'demo', edges: [{ sourceRef: 'n1', targetRef: 'n2' }] }),
  ).rejects.toMatchObject({
    code: 'TOOL_EXECUTION_FAILED',
    details: { upstreamResult: results, snapshot: { objects } },
  });
});
test('focus includes connected neighbors and edges at the requested depth', async () => {
  const { service } = setup();
  const result = await service.call('prg_inspect', { project: 'demo', focusRef: 'n1', depth: 1 });
  expect(result).toMatchObject({ objects, total: 3 });
});
test('strict inputs block filesystem parameters and invalid refs before invoking upstream', async () => {
  const { service, invoke } = setup();
  await expect(
    service.call('prg_inspect', { project: 'demo', path: 'C:/private.prg' }),
  ).rejects.toMatchObject({ code: 'TOOL_INPUT_INVALID' });
  await expect(service.call('prg_delete', { project: 'demo', refs: ['e1'] })).rejects.toMatchObject({
    code: 'TOOL_INPUT_INVALID',
  });
  expect(invoke).not.toHaveBeenCalled();
});
test('creation cannot claim verified when requested style was ignored', async () => {
  const changed = {
    objects: [
      ...objects,
      { ref: 'n3', type: 'TextNode', text: 'X', color: [0, 0, 0, 0], size: { width: 100, height: 76 } },
    ],
  };
  const { service } = setup([{ objects }, { success: true, ref: 'n3', sizeAdjust: 'auto' }, changed]);
  await expect(
    service.call('prg_create', {
      project: 'demo',
      text: 'X',
      color: [80, 160, 240, 1],
      width: 300,
      sizeAdjust: 'manual',
    }),
  ).rejects.toMatchObject({ code: 'MUTATION_VERIFICATION_FAILED' });
});
test('layout cannot claim verified when connected nodes remain overlapping', async () => {
  const unchanged = { objects: objects.map((o) => ({ ...o, position: { x: 0, y: 0 } })) };
  const { service } = setup([unchanged, { success: true, movedCount: 2, internalEdgeCount: 1 }, unchanged]);
  await expect(service.call('prg_layout', { project: 'demo', refs: ['n1', 'n2'] })).rejects.toMatchObject({
    code: 'MUTATION_VERIFICATION_FAILED',
  });
});
test('layout accepts already correctly arranged nodes without requiring a gratuitous change', async () => {
  const arranged = {
    objects: objects.map((o) => ({ ...o, position: { x: o.ref === 'n2' ? 300 : 0, y: 0 } })),
  };
  const { service } = setup([arranged, { success: true, movedCount: 2, internalEdgeCount: 1 }, arranged]);
  expect(await service.call('prg_layout', { project: 'demo', refs: ['n1', 'n2'] })).toMatchObject({
    verified: true,
  });
});
