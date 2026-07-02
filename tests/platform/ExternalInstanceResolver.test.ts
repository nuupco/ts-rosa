import { describe, it, expect, vi } from 'vitest';
import {
  registerExternalInstanceResolver,
  getExternalInstanceResolver,
  type ExternalInstanceResolver,
} from '../../src/platform/ExternalInstanceResolver.ts';

describe('ExternalInstanceResolver seam', () => {
  it('throws a clear, actionable error when unregistered', async () => {
    // `tests/setup.ts` registers a default (rejecting) resolver globally so
    // downstream hydration tests always have a working seam without
    // per-file boilerplate (task 12). To exercise the seam's own
    // unregistered-state error message, reset the module registry and
    // re-import a fresh, unregistered instance of the seam module.
    vi.resetModules();
    const fresh = await import('../../src/platform/ExternalInstanceResolver.ts');
    expect(() => fresh.getExternalInstanceResolver()).toThrowError(
      /ExternalInstanceResolver provider is not registered/,
    );
  });

  it('returns the registered instance after registration', () => {
    const resolver: ExternalInstanceResolver = {
      resolve: async (uri: string) => `content for ${uri}`,
    };
    registerExternalInstanceResolver(resolver);
    expect(getExternalInstanceResolver()).toBe(resolver);
  });
});
