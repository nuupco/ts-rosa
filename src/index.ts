// @nuup/ts-rosa — public entry point.
// Behavior-compatible TypeScript reimplementation of JavaRosa (XForms engine).

// Phase 1: Core data model + minimal parser
export * from './model/data/index.ts';
export * from './model/instance/index.ts';
export * from './model/def/index.ts';
export * from './parse/index.ts';
export * from './session/index.ts';
export { registerXmlParser, getXmlParser, type XmlParser } from './platform/XmlParser.ts';
export {
  registerExternalInstanceResolver,
  getExternalInstanceResolver,
  type ExternalInstanceResolver,
} from './platform/ExternalInstanceResolver.ts';
export { resolveExternalInstances } from './parse/resolveExternalInstances.ts';
