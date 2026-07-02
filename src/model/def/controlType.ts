export type ControlType = 'input' | 'select1' | 'select' | 'rank' | 'trigger' | 'upload' | 'range' | 'secret' | 'unknown';

/**
 * Maps an XForms element localName to a ControlType.
 * group/repeat are NOT controls — they are handled as structural containers in FormElement.
 *
 * NOTE: 'rank' shares its answer codec/DataType ('selectMulti') with 'select'
 * (see DataType.ts), but remains a DISTINCT controlType discriminator — do not
 * conflate rank with select_multiple in consumer code. They differ in UI
 * affordance (ordered ranking vs. unordered multi-pick) even though the wire
 * representation (space-separated ordered tokens) and codec are identical.
 */
export function controlTypeFromTag(localName: string): ControlType {
  switch (localName) {
    case 'input':   return 'input';
    case 'select1': return 'select1';
    case 'select':  return 'select';
    case 'rank':    return 'rank';
    case 'trigger': return 'trigger';
    case 'upload':  return 'upload';
    case 'range':   return 'range';
    case 'secret':  return 'secret';
    default:        return 'unknown';
  }
}
