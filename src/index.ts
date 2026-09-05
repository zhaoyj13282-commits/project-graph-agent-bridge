#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProjectGraphCliAdapter } from './cli/ProjectGraphCliAdapter.js';
import { ProjectGraphCliError } from './cli/ProjectGraphCliError.js';
import { locateProjectGraphCli } from './cli/ProjectGraphCliLocator.js';
import { loadConfig } from './projects/config.js';
import { ProjectRegistry } from './projects/ProjectRegistry.js';
import { GraphService, requiredTools } from './graph/GraphService.js';
import { createServer } from './mcp/createServer.js';
import { toolSchemas, type ToolName } from './mcp/schemas.js';
async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { config: { type: 'string' }, input: { type: 'string' }, 'input-stdin': { type: 'boolean' } },
  });
  const command = positionals[0];
  if (command === 'probe' && positionals.length === 1 && !values.config) {
    let prefixArgs: string[];
    try {
      prefixArgs = z.array(z.string()).parse(JSON.parse(process.env.PROJECT_GRAPH_CLI_ARGS ?? '[]'));
    } catch {
      throw new ProjectGraphCliError(
        'CONFIG_INVALID',
        'PROJECT_GRAPH_CLI_ARGS must be a JSON array of strings.',
      );
    }
    const executable = await locateProjectGraphCli();
    const adapter = new ProjectGraphCliAdapter({
      executable,
      prefixArgs,
      timeoutMs: Number(process.env.PROJECT_GRAPH_TIMEOUT_MS ?? 5000),
    });
    process.stdout.write(JSON.stringify(await adapter.probe()) + '\n');
    return;
  }
  if (
    !(
      (command === 'mcp' && positionals[1] === 'stdio' && positionals.length === 2) ||
      (command === 'call' && positionals.length === 2) ||
      (command === 'probe' && positionals.length === 1)
    )
  )
    throw new ProjectGraphCliError(
      'INVALID_COMMAND',
      'Usage: bridge probe | bridge mcp stdio --config FILE | bridge call prg_TOOL --config FILE --input JSON',
    );
  const configPath = values.config ?? process.env.PROJECT_GRAPH_BRIDGE_CONFIG;
  if (!configPath)
    throw new ProjectGraphCliError('CONFIG_INVALID', 'Provide --config or PROJECT_GRAPH_BRIDGE_CONFIG.');
  const config = await loadConfig(configPath);
  const executable = await locateProjectGraphCli({ configuredPath: config.cli.executable, env: {} });
  const adapter = new ProjectGraphCliAdapter({ ...config.cli, executable });
  const capabilities = await adapter.probe(requiredTools);
  if (command === 'probe') {
    process.stdout.write(JSON.stringify(capabilities) + '\n');
    return;
  }
  const service = new GraphService(
    adapter,
    new ProjectRegistry({ allowedRoots: config.allowedRoots, projects: config.projects }),
  );
  if (command === 'mcp') {
    await createServer(service).connect(new StdioServerTransport());
    return;
  }
  const name = positionals[1]!;
  if (!Object.hasOwn(toolSchemas, name))
    throw new ProjectGraphCliError('INVALID_COMMAND', 'Unknown bridge tool.');
  let input: unknown;
  try {
    if (values.input !== undefined && values['input-stdin']) throw new Error('Choose one input source.');
    let json = values.input ?? '{}';
    if (values['input-stdin']) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 1024 * 1024) throw new Error('Input exceeds 1 MiB.');
        chunks.push(bytes);
      }
      json = Buffer.concat(chunks).toString('utf8');
    }
    input = JSON.parse(json);
  } catch {
    throw new ProjectGraphCliError('TOOL_INPUT_INVALID', '--input must be JSON.');
  }
  process.stdout.write(JSON.stringify(await service.call(name as ToolName, input)) + '\n');
}
main().catch((error) => {
  const normalized =
    error instanceof ProjectGraphCliError
      ? error
      : new ProjectGraphCliError('UNKNOWN', error instanceof Error ? error.message : String(error));
  process.stderr.write(JSON.stringify(normalized) + '\n');
  process.exitCode = 1;
});
