/**
 * applyPreloads — walk the instance tree and stamp preloaded values.
 *
 * MUST be called BEFORE FormEvaluator.initializeInstance (the calculate
 * cascade) so that preloaded dates/uids are visible to calculates.
 *
 * Source: org.javarosa.xform.parse.FormDef#preloadInstance (reference/javarosa)
 */

import type { InstanceTree } from '../../model/instance/InstanceTree.ts';
import type { InstanceNode } from '../../model/instance/InstanceNode.ts';
import type { PreloadProvider } from '../PreloadProvider.ts';
import { INDEX_TEMPLATE } from '../../model/instance/multiplicity.ts';
import { resolvePreload } from './resolvePreload.ts';
import { cast } from '../../model/data/codecs.ts';

// ---------------------------------------------------------------------------
// Internal walker
// ---------------------------------------------------------------------------

function applyPreloadsToNode(node: InstanceNode, provider: PreloadProvider): void {
  // Skip INDEX_TEMPLATE multiplicity nodes (repeat templates)
  if (node.multiplicity === INDEX_TEMPLATE) {
    return;
  }

  // If this node has preload metadata, resolve and assign
  if (node.preload != null) {
    const raw = resolvePreload(node.preload, node.preloadParams ?? null, provider);
    if (raw !== null) {
      const answer = cast(node.dataType, raw);
      node.value = answer ?? null;
    }
  }

  // Recurse into children
  for (const child of node.children) {
    applyPreloadsToNode(child, provider);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk the instance tree; for each node carrying preload metadata (and not a
 * repeat template), resolve + cast and assign node.value. Mutates the tree.
 *
 * MUST run before FormEvaluator.initializeInstance (calculate cascade).
 */
export function applyPreloads(tree: InstanceTree, provider: PreloadProvider): void {
  applyPreloadsToNode(tree.root, provider);
}
