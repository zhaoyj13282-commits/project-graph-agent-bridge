import { z } from 'zod';

export const toolDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    inputSchema: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export type ProjectGraphToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ProjectGraphToolSummary = ProjectGraphToolDefinition;
export type UpstreamCapabilities = { version: string; tools: ProjectGraphToolDefinition[] };
export type InvokeOptions = { allowUpgrade?: boolean; signal?: AbortSignal };
export type CliOptions = {
  executable: string;
  /** For an explicitly configured Node CLI entry point; never interpreted by a shell. */
  prefixArgs?: readonly string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
};
