import { z } from 'zod';
import { ProjectGraphCliAdapter } from '../cli/ProjectGraphCliAdapter.js';
import { ProjectGraphCliError } from '../cli/ProjectGraphCliError.js';
import { ProjectRegistry } from '../projects/ProjectRegistry.js';
import { toolSchemas, type ToolName } from '../mcp/schemas.js';
export const objectSchema = z
  .object({
    ref: z.string().regex(/^[ne][1-9]\d*$/),
    type: z.string(),
    text: z.string().optional(),
    sourceRef: z.string().optional(),
    targetRef: z.string().optional(),
  })
  .passthrough();
const snapshotSchema = z.object({ objects: z.array(objectSchema) });
type Snapshot = z.infer<typeof snapshotSchema>;
type GraphObject = z.infer<typeof objectSchema>;
export const requiredTools = [
  'get_all_nodes',
  'create_text_node',
  'edit_text_node',
  'create_edges',
  'delete_nodes',
  'auto_layout_dag',
];
function failureFromResult(result: unknown): ProjectGraphCliError | undefined {
  const failed = Array.isArray(result) ? result.find((item) => item?.success === false) : result;
  if (!failed || typeof failed !== 'object' || !('success' in failed) || failed.success !== false) return;
  const detail = 'error' in failed ? failed.error : undefined;
  const code =
    detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string'
      ? detail.code
      : 'TOOL_EXECUTION_FAILED';
  const message =
    typeof detail === 'string'
      ? detail
      : detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string'
        ? detail.message
        : 'Upstream tool reported failure.';
  return new ProjectGraphCliError(code, message, { upstreamCode: code, details: { upstreamResult: result } });
}
function normalize(error: unknown) {
  return error instanceof ProjectGraphCliError
    ? error
    : new ProjectGraphCliError('UNKNOWN', error instanceof Error ? error.message : String(error));
}
export class GraphService {
  constructor(
    private readonly adapter: ProjectGraphCliAdapter,
    private readonly registry: ProjectRegistry,
  ) {}
  private async snapshot(path: string, signal?: AbortSignal): Promise<Snapshot> {
    const raw = await this.adapter.invoke('get_all_nodes', path, {}, { signal });
    const failure = failureFromResult(raw);
    if (failure) throw failure;
    const parsed = snapshotSchema.safeParse(raw);
    if (!parsed.success)
      throw new ProjectGraphCliError('CLI_INVALID_OUTPUT', 'Unexpected graph snapshot shape.');
    return parsed.data;
  }
  async call(name: ToolName, input: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const parsed = toolSchemas[name].safeParse(input);
    if (!parsed.success)
      throw new ProjectGraphCliError('TOOL_INPUT_INVALID', 'Invalid tool input.', {
        details: parsed.error.issues,
      });
    if (name === 'prg_list_projects') return { projects: this.registry.list() };
    const data = parsed.data as Exclude<typeof parsed.data, Record<string, never>> & { project: string };
    const path = await this.registry.resolve(
      data.project,
      name === 'prg_inspect' ? 'read' : name === 'prg_delete' ? 'destructive' : 'write',
    );
    const before = await this.snapshot(path, signal);
    if (name === 'prg_inspect') {
      const args = toolSchemas.prg_inspect.parse(input);
      let objects = before.objects;
      if (args.search !== undefined) {
        const needle = args.search.toLocaleLowerCase();
        objects = objects.filter((o) => o.text?.toLocaleLowerCase().includes(needle));
      } else if (args.focusRef) {
        this.requireRefs([args.focusRef], before);
        const refs = new Set([args.focusRef]);
        const focus = objects.find((o) => o.ref === args.focusRef)!;
        if (focus.sourceRef && focus.targetRef) {
          refs.add(focus.sourceRef);
          refs.add(focus.targetRef);
        }
        for (let i = 0; i < args.depth; i++) {
          const previous = new Set(refs);
          for (const object of objects)
            if (
              object.sourceRef &&
              object.targetRef &&
              (previous.has(object.sourceRef) || previous.has(object.targetRef))
            ) {
              refs.add(object.sourceRef);
              refs.add(object.targetRef);
            }
        }
        objects = objects.filter(
          (o) =>
            refs.has(o.ref) || (o.sourceRef && o.targetRef && refs.has(o.sourceRef) && refs.has(o.targetRef)),
        );
      }
      return {
        project: args.project,
        objects: objects.slice(args.offset, args.offset + args.limit),
        total: objects.length,
        totalProjectObjects: before.objects.length,
        offset: args.offset,
        ...(args.offset + args.limit < objects.length ? { nextOffset: args.offset + args.limit } : {}),
      };
    }
    let tool: string,
      upstreamInput: unknown,
      refs: string[] = [];
    switch (name) {
      case 'prg_create': {
        const { project, ...args } = toolSchemas.prg_create.parse(input);
        tool = 'create_text_node';
        upstreamInput = args;
        break;
      }
      case 'prg_edit': {
        const { project, ...args } = toolSchemas.prg_edit.parse(input);
        tool = 'edit_text_node';
        upstreamInput = args;
        refs = [args.ref];
        break;
      }
      case 'prg_connect': {
        const { project, ...args } = toolSchemas.prg_connect.parse(input);
        tool = 'create_edges';
        upstreamInput = args;
        refs = args.edges.flatMap((e) => [e.sourceRef, e.targetRef]);
        break;
      }
      case 'prg_delete': {
        const { project, ...args } = toolSchemas.prg_delete.parse(input);
        tool = 'delete_nodes';
        upstreamInput = args;
        refs = args.refs;
        break;
      }
      case 'prg_layout': {
        const { project, ...args } = toolSchemas.prg_layout.parse(input);
        tool = 'auto_layout_dag';
        upstreamInput = args;
        refs = args.refs;
        break;
      }
      default:
        throw new ProjectGraphCliError('INVALID_COMMAND', 'Unknown graph tool.');
    }
    this.requireRefs(refs, before);
    let result: unknown, after: Snapshot | undefined;
    try {
      result = await this.adapter.invoke(tool, path, upstreamInput, { signal });
      const failure = failureFromResult(result);
      if (failure) throw failure;
      after = await this.snapshot(path, signal);
      if (!this.verify(name, input, result, before, after))
        throw new ProjectGraphCliError(
          'MUTATION_VERIFICATION_FAILED',
          'Reported mutation could not be verified. Inspect current state before any further change.',
          { details: { upstreamResult: result } },
        );
    } catch (error) {
      const normalized = normalize(error);
      let inspectError: unknown;
      if (!after && !signal?.aborted) {
        try {
          after = await this.snapshot(path, signal);
        } catch (error) {
          inspectError = normalize(error).toJSON();
        }
      }
      throw new ProjectGraphCliError(normalized.code, normalized.message, {
        upstreamCode: normalized.upstreamCode,
        exitCode: normalized.exitCode,
        details: {
          ...(normalized.details && typeof normalized.details === 'object'
            ? normalized.details
            : { upstreamDetails: normalized.details }),
          mutationMayHaveApplied: true,
          upstreamResult: result,
          snapshot: after,
          inspectError,
        },
      });
    }
    const previous = new Map(before.objects.map((o) => [o.ref, o]));
    const current = new Map(after.objects.map((o) => [o.ref, o]));
    const affected = new Set(refs);
    for (const o of after.objects)
      if (JSON.stringify(previous.get(o.ref)) !== JSON.stringify(o)) affected.add(o.ref);
    const removedRefs = before.objects.filter((o) => !current.has(o.ref)).map((o) => o.ref);
    return {
      project: data.project,
      success: true,
      verified: true,
      verification:
        'Graph fields were re-read; sizeAdjust is acknowledged by the runtime because snapshots omit it.',
      upstream: result,
      beforeCount: before.objects.length,
      afterCount: after.objects.length,
      objects: after.objects.filter((o) => affected.has(o.ref)),
      removedRefs,
      persistence:
        'Runtime state verified. If the project is open, save in Project Graph to persist to disk.',
    };
  }
  private requireRefs(refs: string[], snapshot: Snapshot) {
    const known = new Set(snapshot.objects.map((o) => o.ref));
    const missingRefs = [...new Set(refs)].filter((ref) => !known.has(ref));
    if (missingRefs.length)
      throw new ProjectGraphCliError(
        'UNKNOWN_REF',
        'References are absent from the fresh snapshot. Inspect again; do not guess replacement refs.',
        { details: { missingRefs, snapshot } },
      );
  }
  private verify(
    name: ToolName,
    input: unknown,
    result: unknown,
    before: Snapshot,
    after: Snapshot,
  ): boolean {
    const byRef = new Map(after.objects.map((o) => [o.ref, o]));
    const matches = (object: GraphObject | undefined, data: Record<string, unknown>) =>
      object !== undefined &&
      Object.entries(data).every(([key, value]) => {
        if (key === 'sizeAdjust')
          return (
            result !== null &&
            typeof result === 'object' &&
            'sizeAdjust' in result &&
            result.sizeAdjust === value
          );
        if (key === 'width')
          return (
            !!object.size &&
            typeof object.size === 'object' &&
            'width' in object.size &&
            Math.abs(Number(object.size.width) - Number(value)) < 0.01
          );
        return JSON.stringify(object[key]) === JSON.stringify(value);
      });
    switch (name) {
      case 'prg_create': {
        const { project, ...args } = toolSchemas.prg_create.parse(input);
        const parsed = z
          .object({ ref: z.string().regex(/^n[1-9]\d*$/), success: z.literal(true) })
          .safeParse(result);
        return (
          parsed.success &&
          !before.objects.some((o) => o.ref === parsed.data.ref) &&
          matches(byRef.get(parsed.data.ref), args)
        );
      }
      case 'prg_edit': {
        const args = toolSchemas.prg_edit.parse(input);
        return matches(byRef.get(args.ref), args.data);
      }
      case 'prg_connect': {
        const args = toolSchemas.prg_connect.parse(input);
        return args.edges.every((e) =>
          after.objects.some(
            (o) => o.sourceRef === e.sourceRef && o.targetRef === e.targetRef && o.text === e.text,
          ),
        );
      }
      case 'prg_delete': {
        const args = toolSchemas.prg_delete.parse(input);
        return (
          args.refs.every((ref) => !byRef.has(ref)) &&
          !after.objects.some(
            (o) => args.refs.includes(o.sourceRef ?? '') || args.refs.includes(o.targetRef ?? ''),
          )
        );
      }
      case 'prg_layout': {
        const args = toolSchemas.prg_layout.parse(input);
        const report = z
          .object({
            success: z.literal(true),
            movedCount: z.number().int().nonnegative(),
            internalEdgeCount: z.number().int().positive(),
          })
          .safeParse(result);
        const point = z.object({ x: z.number().finite(), y: z.number().finite() });
        const positions = new Map(args.refs.map((ref) => [ref, point.safeParse(byRef.get(ref)?.position)]));
        const edges = after.objects.filter(
          (o) =>
            o.sourceRef && o.targetRef && args.refs.includes(o.sourceRef) && args.refs.includes(o.targetRef),
        );
        return (
          report.success &&
          report.data.movedCount === new Set(args.refs).size &&
          report.data.internalEdgeCount === edges.length &&
          [...positions.values()].every((p) => p.success) &&
          edges.every((edge) => {
            const source = positions.get(edge.sourceRef!)!,
              target = positions.get(edge.targetRef!)!;
            return source.success && target.success && target.data.x > source.data.x;
          })
        );
      }
      default:
        return false;
    }
  }
}
