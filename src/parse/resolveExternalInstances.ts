/**
 * resolveExternalInstances — async hydration step for `jr://` external
 * secondary instances (design §6, spec R4).
 *
 * Fetches raw content for each declared `FormDefinition.externalInstances`
 * entry via the registered `ExternalInstanceResolver`, parses it as CSV, and
 * merges the resulting InstanceTree into `secondaryInstances` — producing a
 * FormDefinition indistinguishable in shape from one where the instance was
 * declared inline. `parseForm` stays synchronous/pure; this step is the only
 * place I/O happens.
 *
 * Fail-loud (spec R5): a rejecting resolver or malformed CSV both throw with
 * an operation-prefixed message identifying the offending instance id/src.
 * An unregistered resolver seam propagates its own error unchanged.
 */

import type { FormDefinition } from '../model/def/FormDefinition.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import { getExternalInstanceResolver } from '../platform/ExternalInstanceResolver.ts';
import { csvToInstanceTree } from './csv/csvToInstanceTree.ts';

export async function resolveExternalInstances(definition: FormDefinition): Promise<FormDefinition> {
  if (definition.externalInstances.size === 0) {
    return definition;
  }

  const resolver = getExternalInstanceResolver();
  const merged = new Map<string, InstanceTree>(definition.secondaryInstances);

  for (const [id, { src }] of definition.externalInstances) {
    let raw: string;
    try {
      raw = await resolver.resolve(src);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: failed to resolve external instance '${id}' (${src}): ${String(cause)}`,
      );
    }

    let tree: InstanceTree;
    try {
      tree = csvToInstanceTree(id, raw);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: external instance '${id}' (${src}) has malformed CSV: ${String(cause)}`,
      );
    }

    merged.set(id, tree);
  }

  return { ...definition, secondaryInstances: merged };
}
