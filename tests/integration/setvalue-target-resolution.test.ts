/**
 * Integration tests — setvalue action runtime target ref resolution over a
 * real parsed form (sdd/setvalue-parity PR2, tasks 10-11, design Decision 2/3).
 *
 * Target refs are resolved at FIRE TIME via the XPath seam
 * (`compileInstanceXPath` / `evaluateTyped` → NODESET), not via parse-time
 * string manipulation. This exercises absolute, host-relative, `..`-relative,
 * and repeat-indexed (`[position()=1]`) target refs, plus the fail-loud
 * cardinality contract (0 nodes / N>1 nodes / non-NODESET all throw).
 */

import { describe, it, expect } from 'vitest';
import {
  html,
  head,
  body,
  model,
  mainInstance,
  bind,
  input,
  t,
  title,
  setvalue,
  setvalueLiteral,
  group,
  repeat,
} from '../harness/XFormsElement.ts';
import { Scenario } from '../harness/Scenario.ts';
import '../harness/matchers.ts';

describe('setvalue target resolution — absolute ref', () => {
  it('resolves and writes to an absolute target', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Absolute target'),
          model(
            mainInstance(t('data id="abs"', t('a'))),
            bind('/data/a').type('int'),
            setvalue('odk-instance-first-load', '/data/a', '4*4'),
          ),
        ),
        body(input('/data/a')),
      ),
    );

    expect(scenario.answerOf('/data/a')).intAnswer(16);
  });
});

describe('setvalue target resolution — host-relative ref', () => {
  it('resolves a bare relative ref against the enclosing host (group) node', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Host-relative target'),
          model(
            mainInstance(t('data id="hostrel"', t('g', t('a'), t('b')))),
            bind('/data/g/a').type('string'),
            bind('/data/g/b').type('int'),
          ),
        ),
        body(
          group(
            '/data/g',
            input('/data/g/a'),
            setvalueLiteral('odk-instance-first-load', 'b', '7'),
          ),
        ),
      ),
    );

    expect(scenario.answerOf('/data/g/b')).intAnswer(7);
  });
});

describe('setvalue target resolution — ..-relative ref', () => {
  it('resolves a parent-navigating ref against the host node inside a repeat', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Dot-dot relative target'),
          model(
            mainInstance(t('data id="dotdot"', t('reps', t('a'), t('b')))),
            bind('/data/reps/a').type('string'),
            bind('/data/reps/b').type('int'),
          ),
        ),
        body(
          repeat(
            '/data/reps',
            input('/data/reps/a', setvalueLiteral('xforms-value-changed', '../b', '9')),
          ),
        ),
      ),
    );

    scenario.answer('/data/reps[1]/a', 'x');
    expect(scenario.answerOf('/data/reps[1]/b')).intAnswer(9);
  });
});

describe('setvalue target resolution — repeat-indexed absolute ref', () => {
  it('resolves /data/repeat[position()=1]/x to the first repeat instance only', () => {
    const scenario = Scenario.init(
      html(
        head(
          title('Repeat-indexed target'),
          model(
            mainInstance(
              t('data id="repidx"', t('reps', t('x')), t('reps', t('x'))),
            ),
            bind('/data/reps/x').type('string'),
            setvalue('odk-instance-first-load', "/data/reps[position()=1]/x", "'first'"),
          ),
        ),
        body(repeat('/data/reps', input('/data/reps/x'))),
      ),
    );

    expect(scenario.answerOf('/data/reps[1]/x')).stringAnswer('first');
    expect(scenario.answerOf('/data/reps[2]/x')).toBeNull();
  });
});

describe('setvalue target resolution — non-NODESET result fail-loud', () => {
  it('throws when the target ref evaluates to a non-NODESET result (e.g. a numeric expression)', () => {
    expect(() =>
      Scenario.init(
        html(
          head(
            title('Non-nodeset target'),
            model(
              mainInstance(t('data id="nonnodeset"', t('a'))),
              bind('/data/a').type('int'),
              setvalue('odk-instance-first-load', '/data/a = 1', "'x'"),
            ),
          ),
          body(input('/data/a')),
        ),
      ),
    ).toThrow(/did not evaluate to a nodeset/);
  });
});

describe('setvalue target resolution — $var parity with value expressions', () => {
  it('a $var-rooted target ref fails the same way an unbound $var value expression would (same seam, same variable binding rules)', () => {
    // Neither a setvalue target ref nor a setvalue value expression has any
    // mechanism in this codebase to bind external XPath variables (no
    // FormEvaluator call site passes InstanceEvaluationContext.variables).
    // This proves target resolution goes through the exact same seam as a
    // value expression, rather than a bespoke resolver: both fail loud with
    // an "unbound"/undefined-variable style error, not a silent value.
    let targetError: unknown;
    try {
      Scenario.init(
        html(
          head(
            title('Var target'),
            model(
              mainInstance(t('data id="vartarget"', t('a'))),
              bind('/data/a').type('string'),
              setvalue('odk-instance-first-load', '$myvar', "'x'"),
            ),
          ),
          body(input('/data/a')),
        ),
      );
    } catch (e) {
      targetError = e;
    }

    let valueError: unknown;
    try {
      Scenario.init(
        html(
          head(
            title('Var value'),
            model(
              mainInstance(t('data id="varvalue"', t('a'))),
              bind('/data/a').type('string'),
              setvalue('odk-instance-first-load', '/data/a', '$myvar'),
            ),
          ),
          body(input('/data/a')),
        ),
      );
    } catch (e) {
      valueError = e;
    }

    expect(targetError).toBeInstanceOf(Error);
    expect(valueError).toBeInstanceOf(Error);
  });
});

describe('setvalue target resolution — cardinality fail-loud contract (Decision 3)', () => {
  it('throws when the target ref resolves to zero nodes', () => {
    expect(() =>
      Scenario.init(
        html(
          head(
            title('Zero-node target'),
            model(
              mainInstance(t('data id="zero"', t('a'))),
              bind('/data/a').type('string'),
              setvalue('odk-instance-first-load', '/data/does-not-exist', "'x'"),
            ),
          ),
          body(input('/data/a')),
        ),
      ),
    ).toThrow(/resolved to no nodes/);
  });

  it('throws when the target ref resolves to more than one node (no first-match fallback)', () => {
    expect(() =>
      Scenario.init(
        html(
          head(
            title('Multi-node target'),
            model(
              mainInstance(t('data id="multi"', t('reps', t('x')), t('reps', t('x')))),
              bind('/data/reps/x').type('string'),
              setvalue('odk-instance-first-load', '/data/reps/x', "'y'"),
            ),
          ),
          body(repeat('/data/reps', input('/data/reps/x'))),
        ),
      ),
    ).toThrow(/resolved to 2 nodes/);
  });
});
