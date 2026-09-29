/**
 * Regression test — real production XForm "lecturas de riego".
 *
 * Loads the actual fixture (tests/fixtures/forms/lecturas-de-riego.xml) and
 * exercises its `calculate` bindings for irrigation duration/volume/lamina
 * end-to-end, through decimal-time(), to catch the "hora_inicio/hora_fin
 * with a trailing Z breaks the calculation" bug class at the form level —
 * independent of the unit-level time-codec-offset work happening elsewhere.
 *
 * `superficie` is itself a calculate driven by pulldata() against an
 * external `jr://file-csv/sectores.csv` secondary instance. Following the
 * pattern in tests/xpath/pulldata-csv-external.test.ts, we register a
 * synthetic in-memory CSV resolver and answer `id_sector` so the form's own
 * pulldata() calculate resolves `superficie` to 25 — no direct override of
 * the calculate field is needed or attempted.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Scenario } from '../../harness/Scenario.ts';
import { parseForm } from '../../../src/parse/XFormParser.ts';
import { resolveExternalInstances } from '../../../src/parse/resolveExternalInstances.ts';
import { registerExternalInstanceResolver } from '../../../src/platform/ExternalInstanceResolver.ts';
import '../../harness/matchers.ts';

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/forms/lecturas-de-riego.xml',
);

const BASE =
  '/axmY3Z7Ds7qeeLPPYK6rG6';

describe('lecturas-de-riego — real form calculate bindings', () => {
  it('computes duracion_riego_1/duracion_riego/volumen_aplicado/lamina_aplicada from a single day of data', async () => {
    registerExternalInstanceResolver({
      resolve: (uri: string) => {
        if (uri === 'jr://file-csv/sectores.csv') {
          return Promise.resolve(
            'id_sector,superficie,cultivo,sistema_riego\n' +
              'sector-1,25,maiz,goteo\n',
          );
        }
        // Other secondary-instance CSVs referenced by this real form aren't
        // relevant to the calculations under test; resolve them to an empty
        // (header-only) sheet so the form can still parse and hydrate.
        return Promise.resolve('id\n');
      },
    });

    const xml = readFileSync(FIXTURE, 'utf8');
    const def = parseForm(xml);
    const resolved = await resolveExternalInstances(def);
    const scenario = Scenario.fromDefinition(resolved);

    // Trigger the pulldata()-driven superficie calculate.
    scenario.answer(`${BASE}/seccion_a/seccion_a_pantalla1/id_sector`, 'sector-1');
    expect(
      scenario.answerOf(`${BASE}/seccion_a/seccion_a_pantalla1/superficie`),
    ).stringAnswer('25');

    // dia1's group is only relevant when dias_riego >= 1.
    scenario.answer(`${BASE}/seccion_a2/seccion_a2_pantalla2/dias_riego`, 1);

    // Only día 1 has data.
    scenario.answer(
      `${BASE}/seccion_a2/seccion_a2_pantalla2/dia1/fecha_riego_inicio_1`,
      '2026-09-28',
    );
    scenario.answer(
      `${BASE}/seccion_a2/seccion_a2_pantalla2/dia1/hora_riego_inicio_1`,
      '18:44:00.000Z',
    );
    scenario.answer(
      `${BASE}/seccion_a2/seccion_a2_pantalla2/dia1/hora_riego_fin_1`,
      '20:45:00.000Z',
    );

    // round((20:45 - 18:44) * 24, 2) = round(2.01666..., 2) = 2.02
    //
    // NOTE: as of this writing this assertion is RED. `decimal-time()`
    // (src/xpath/vendor/xpath/functions/xforms/datetime.ts) calls
    // `isValidTimeString()` (src/xpath/vendor/xpath/lib/datetime/predicates.ts),
    // which does `Temporal.PlainTime.from(value)` and returns `false` for any
    // time string carrying a trailing `Z`/offset designator (e.g.
    // "18:44:00.000Z"), throwing internally. That makes `decimal-time()`
    // return NaN for exactly this ODK Collect on-device time format, which
    // is the real-world bug class this fixture-based test exists to catch
    // end-to-end. This is expected to turn GREEN once the offset-aware time
    // handling (tracked separately in the sibling work on
    // src/model/data/codecs.ts / AnswerValue.ts, or a fix to
    // isValidTimeString/decimal-time itself) lands. The assertion is left as
    // the ground-truth correct value, not the currently-observed NaN.
    expect(
      scenario.answerOf(`${BASE}/seccion_a2/seccion_a2_pantalla2/dia1/duracion_riego_1`),
    ).stringAnswer('2.02');

    // Days 2-9 are empty → treated as 0, so duracion_riego == duracion_riego_1.
    expect(
      scenario.answerOf(`${BASE}/seccion_a2/seccion_a2_pantalla2/duracion_riego`),
    ).stringAnswer('2.02');

    // volumen_aplicado = duracion_riego * 3.6 = 2.02 * 3.6 = 7.272
    expect(
      scenario.answerOf(`${BASE}/seccion_a2/seccion_a2_pantalla2/volumen_aplicado`),
    ).stringAnswer('7.272');

    // lamina_aplicada = (volumen_aplicado div superficie) * 0.01
    //                 = (7.272 / 25) * 0.01
    // The mathematically exact result is 0.0029088, but IEEE-754 double
    // arithmetic for this specific division/multiplication chain produces
    // 0.0029088000000000004. Verified (odd/tasks/time-codec-offset-aware.md
    // Part 3/Part 4) against JavaRosa's own XPathFuncExpr.toString(Object):
    // this value is neither near-zero (|d| < 1e-12) nor near-integer
    // (|d - (int) d| < 1e-12), so it falls through to JavaRosa's
    // String.valueOf(d) fallback too — the original Java engine would
    // produce the same noisy string, so this is expected fidelity, not a bug.
    expect(
      scenario.answerOf(`${BASE}/seccion_a2/seccion_a2_pantalla2/lamina_aplicada`),
    ).stringAnswer('0.0029088000000000004');
  });
});
