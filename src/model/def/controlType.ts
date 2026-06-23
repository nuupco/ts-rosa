export type ControlType = 'input' | 'select1' | 'select' | 'trigger' | 'upload' | 'unknown';

/**
 * Maps an XForms element localName to a ControlType.
 * group/repeat are NOT controls — they are handled as structural containers in FormElement.
 */
export function controlTypeFromTag(localName: string): ControlType {
  switch (localName) {
    case 'input':   return 'input';
    case 'select1': return 'select1';
    case 'select':  return 'select';
    case 'trigger': return 'trigger';
    case 'upload':  return 'upload';
    default:        return 'unknown';
  }
}
