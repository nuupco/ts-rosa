/**
 * Default XPath function library collection for ts-rosa.
 *
 * Registers three function namespaces from the vendored @getodk/xpath:
 *   fn  — XPath 1.0 core functions (FN_NAMESPACE_URI)
 *   jr  — JavaRosa extensions (JAVAROSA_NAMESPACE_URI)
 *   xf  — XForms/ODK extensions (XFORMS_NAMESPACE_URI)
 *
 * EXCLUDED sub-modules (circular dependency on XFormsXPathEvaluator):
 *
 *   javarosa/node-set.ts  — vendored `itext`: REPLACED by native itext-fn.ts.
 *     The vendored version calls XFormsXPathEvaluator.getTranslationValues(),
 *     a static method unavailable in ts-rosa's InstanceEvaluator.
 *   xforms/node-set.ts    — vendored `instance` and others: REPLACED for
 *     `instance` by native instance-fn.ts. Remaining functions (count-non-empty,
 *     randomize, etc.) still excluded (DOM-traversal, not yet needed).
 *
 * Both excluded modules import XFormsXPathEvaluator.ts which in turn imports
 * the jr/xf index files, creating a circular module graph that makes the
 * FunctionLibrary constructors receive undefined values. Building the libraries
 * manually from individual sub-modules breaks the cycle.
 *
 * Native shims (instance-fn.ts, itext-fn.ts) read per-form state from the
 * evaluation context's document node (InstanceDocumentNode.secondaryInstances /
 * .itext), never from a global evaluator. No cycle exists in these shims.
 *
 * This is documented in src/xpath/vendor/PATCHES.md.
 *
 * None of these imports touch @getodk/common/lib/dom/* or web-compat/*,
 * so the no-restricted-imports ESLint firewall stays clean.
 */

import {
	FN_NAMESPACE_URI,
	JAVAROSA_NAMESPACE_URI,
	XFORMS_NAMESPACE_URI,
} from '../vendor/common/constants/xmlns.ts';
import { FunctionLibrary } from '../vendor/xpath/evaluator/functions/FunctionLibrary.ts';
import { FunctionLibraryCollection } from '../vendor/xpath/evaluator/functions/FunctionLibraryCollection.ts';
import { fn } from '../vendor/xpath/functions/fn/index.ts';
import * as javarosaSelect from '../vendor/xpath/functions/javarosa/select.ts';
import * as xfBoolean from '../vendor/xpath/functions/xforms/boolean.ts';
import * as xfDatetime from '../vendor/xpath/functions/xforms/datetime.ts';
import * as xfGeo from '../vendor/xpath/functions/xforms/geo.ts';
import * as xfNumber from '../vendor/xpath/functions/xforms/number.ts';
import * as xfSelect from '../vendor/xpath/functions/xforms/select.ts';
import * as xfString from '../vendor/xpath/functions/xforms/string.ts';
import { indexedRepeat } from './xforms-indexed-repeat.ts';
import { instance } from './instance-fn.ts';
import { itext } from './itext-fn.ts';

/**
 * JavaRosa function library — select functions + native itext shim.
 * Excludes vendored javarosa/node-set.ts (circular dep) — see above.
 */
const jr = new FunctionLibrary(JAVAROSA_NAMESPACE_URI, [
	...Object.values(javarosaSelect),
	itext,
]);

/**
 * XForms function library — excludes node-set.ts (DOM-traversal, Slice 4).
 * Includes: boolean (boolean-from-string, checklist, if, …), datetime
 * (date, format-date, …), geo (stub errors only), number (abs, pow, sqrt,
 * pi, round/2, …), select (count-selected, selected, selected-at), string
 * (coalesce, ends-with, regex, substr, …).
 */
const xf = new FunctionLibrary(XFORMS_NAMESPACE_URI, [
	...Object.values(xfBoolean),
	...Object.values(xfDatetime),
	...Object.values(xfGeo),
	...Object.values(xfNumber),
	...Object.values(xfSelect),
	...Object.values(xfString),
	indexedRepeat,
	instance,
]);

// Unprefixed function calls (e.g. date(), if(), selected(), boolean-from-string())
// are resolved by searching default libraries in order: xf first (overrides fn.number,
// adds xforms-specific functions), then fn (XPath 1.0 core).
// jr functions (choice-name) are only accessible via the jr: prefix.
export const defaultFunctions = new FunctionLibraryCollection([fn, jr, xf], {
	defaultNamespaceURIs: [XFORMS_NAMESPACE_URI, FN_NAMESPACE_URI],
});
