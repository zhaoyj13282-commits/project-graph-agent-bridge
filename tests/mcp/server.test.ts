import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { createServer } from '../../src/mcp/createServer.js';
import { GraphService } from '../../src/graph/GraphService.js';
import { ProjectGraphCliError } from '../../src/cli/ProjectGraphCliError.js';
test('standard MCP handshake, exactly seven tools, permission errors as isError', async () => {
  const service = {
    call: async (name: string) => {
      if (name === 'prg_list_projects') return { projects: [] };
      throw new ProjectGraphCliError('PERMISSION_DENIED', 'Read only.');
    },
  } as unknown as GraphService;
  const server = createServer(service);
  const client = new Client({ name: 'bridge-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const list = await client.listTools();
    expect(list.tools).toHaveLength(7);
    expect(list.tools.find((t) => t.name === 'prg_delete')?.annotations?.destructiveHint).toBe(true);
    const result = await client.callTool({ name: 'prg_list_projects', arguments: {} });
    expect(result.structuredContent).toEqual({ projects: [] });
    const denied = await client.callTool({
      name: 'prg_delete',
      arguments: { project: 'demo', refs: ['n1'] },
    });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent).toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
  } finally {
    await client.close();
    await server.close();
  }
});
