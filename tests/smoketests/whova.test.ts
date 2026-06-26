/**
 * WhoVA smoke tests.
 *
 * Ported from:
 *   // Source: org.javarosa.smoketests.WhoVATest#regression_after_2_17_0_relevance_updates
 *   // Source: org.javarosa.smoketests.WhoVATest#smoke_test_route_fever_and_lumps
 */

import { describe, it, expect } from 'vitest';
import { Scenario } from '../harness/Scenario.ts';
import { frozenPreloadProvider } from '../../src/session/PreloadProvider.ts';
import { parseAbsoluteRef, refToString, genericize } from '../../src/model/instance/TreeReference.ts';
import type { TreeReference } from '../../src/model/instance/TreeReference.ts';

function getRef(path: string): TreeReference {
  return genericize(parseAbsoluteRef(path));
}

describe('WhoVATest', () => {
  /**
   * Regression test: after consent + deceased info (sex, dob, dod), the
   * node Id10120_0 should be non-relevant. This guards against a v2.17.0
   * regression where ancestor-group relevance conditions could override
   * descendendant conditions.
   */
  it(
    'regression_after_2_17_0_relevance_updates',
    () => {
      const scenario = Scenario.init('whova_form.xml');

      // Give consent (line 41)
      scenario.next(14);
      scenario.answer('yes');

      // Info on deceased (lines 47-60)
      scenario.next(6);
      scenario.answer('female');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('1998-01-01');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('2018-01-01');

      // Regression assertion (line 76)
      expect(scenario.getAnswerNode('/data/consented/illhistory/illdur/Id10120_0').isRelevant).toBe(false);
    },
    30_000,
  );

  /**
   * Fever+lumps smoke route through the whova form. 7 waypoints verified,
   * ageInDays=7305, isAdult="1", isNeonatal="0", atTheEndOfForm=true.
   */
  it(
    'smoke_test_route_fever_and_lumps',
    () => {
      const scenario = Scenario.init('whova_form.xml', {
        preloadProvider: frozenPreloadProvider({ now: new Date('2018-01-01') }),
      });

      // region Give consent (lines 85-87)
      scenario.next(14);
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/respondent_backgr/Id10013')),
      );
      scenario.answer('yes');

      // region Info on deceased (lines 92-107)
      scenario.next(6);
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/deceased_CRVS/info_on_deceased/Id10019')),
      );
      scenario.answer('female');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('1998-01-01');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('2018-01-01');

      // Sanity checks (lines 110-112)
      expect(scenario.answerOf('/data/consented/deceased_CRVS/info_on_deceased/ageInDays')?.value).toBe('7305');
      expect(scenario.answerOf('/data/consented/deceased_CRVS/info_on_deceased/isAdult')?.value).toBe('1');
      expect(scenario.answerOf('/data/consented/deceased_CRVS/info_on_deceased/isNeonatal')?.value).toBe('0');

      // Skip non yes/no questions (line 115)
      scenario.next(11);
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/illhistory/illdur/id10120_unit')),
      );

      // Answer "no" to 23 questions (lines 119-123)
      for (let i = 0; i < 23; i++) {
        scenario.next();
        if (scenario.atQuestion()) scenario.answer('no');
      }

      // region Signs and symptoms — fever (lines 128-146)
      scenario.next();
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/illhistory/signs_symptoms_final_illness/Id10147')),
      );
      scenario.answer('yes');
      scenario.next();
      scenario.answer('days');
      scenario.next();
      scenario.answer(30);
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('severe');
      scenario.next();
      scenario.answer('nightly');
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/illhistory/signs_symptoms_final_illness/Id10151')),
      );

      // Answer "no" 36 times (lines 150-154)
      for (let i = 0; i < 36; i++) {
        scenario.next();
        if (scenario.atQuestion()) scenario.answer('no');
      }

      // region Signs and symptoms — lumps (lines 159-174)
      scenario.next();
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/illhistory/signs_symptoms_final_illness/Id10253')),
      );
      scenario.answer('yes');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('yes');
      scenario.next();
      scenario.answer('yes');
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/illhistory/signs_symptoms_final_illness/Id10257')),
      );

      // Answer "no" 59 times (lines 178-183)
      for (let i = 0; i < 59; i++) {
        scenario.next();
        if (scenario.atQuestion()) scenario.answer('no');
      }

      // Comment and end (lines 186-191)
      scenario.next();
      expect(refToString(genericize(scenario.refAtIndex()!))).toBe(
        refToString(getRef('/data/consented/comment')),
      );
      scenario.answer('No comments');
      scenario.next();
      expect(scenario.atTheEndOfForm()).toBe(true);
    },
    120_000,
  );
});
