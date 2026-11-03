/**
 * Regression — a definition (e.g. KoboToolbox output) may carry BOTH a
 * `jr:template=""` repeat element and one live default sibling of the same
 * name. The live sibling must not be treated as a non-repeating child.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/parse/XFormParser.ts';
import { hydrateInstance } from '../../../src/model/instance/InstanceHydrator.ts';
import { serializeInstance } from '../../../src/model/instance/InstanceSerializer.ts';

const JR = 'xmlns:jr="http://openrosa.org/javarosa"';

const definition = parseForm(
  `<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" ${JR}>` +
    `<h:head><h:title>t</h:title><model><instance><data id="d"><n/>` +
    `<rep jr:template=""><img/></rep><rep><img/></rep><meta><instanceID/></meta></data></instance>` +
    `<bind nodeset="/data/n" type="string"/><bind nodeset="/data/rep/img" type="binary"/>` +
    `</model></h:head><h:body><input ref="/data/n"/>` +
    `<group ref="/data/rep"><repeat nodeset="/data/rep"><upload ref="/data/rep/img" mediatype="image/*"/></repeat></group>` +
    `</h:body></h:html>`,
);

const submission = (reps: string) => `<data id="d" ${JR}><n>a</n>${reps}<meta><instanceID>u</instanceID></meta></data>`;
const rep = (img: string, attr = '') => `<rep${attr}><img>${img}</img></rep>`;
const count = (xml: string) => (xml.match(/<rep[ >]/g) ?? []).length;

describe('hydrateInstance — template + live sibling in definition', () => {
  it('hydrates two repeat instances without HydrationError and keeps both values', () => {
    const out = serializeInstance(hydrateInstance(definition, submission(rep('1.jpg') + rep('2.jpg'))));
    expect(count(out)).toBe(2);
    expect(out).toContain('<img>1.jpg</img>');
    expect(out).toContain('<img>2.jpg</img>');
  });

  it('does not duplicate a single submitted instance', () => {
    const out = serializeInstance(hydrateInstance(definition, submission(rep('1.jpg'))));
    expect(count(out)).toBe(1);
  });

  it('keeps the default live instance when the submission has none', () => {
    const out = serializeInstance(hydrateInstance(definition, submission('')));
    expect(count(out)).toBe(1);
  });

  it('does not leak jr:template onto hydrated real instances', () => {
    const out = serializeInstance(hydrateInstance(definition, submission(rep('1.jpg') + rep('2.jpg'))));
    expect(out).not.toContain('jr:template');
  });

  it('keeps repeat instances before <meta>', () => {
    const out = serializeInstance(hydrateInstance(definition, submission(rep('1.jpg') + rep('2.jpg'))));
    expect(out.lastIndexOf('<rep>')).toBeLessThan(out.indexOf('<meta>'));
  });
});
