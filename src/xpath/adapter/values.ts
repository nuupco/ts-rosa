/**
 * Value adapter for xmldom nodes.
 *
 * getNodeValue follows XPath 1.0 string-value rules:
 *   - text/CDATA/attr/comment/PI: nodeValue
 *   - element/document: concatenation of all descendant text content
 */

export const getXmldomNodeValue = (node: {
  textContent?: string | null;
  nodeValue?: string | null;
}): string => {
  // textContent covers element/document (all descendant text) as well as
  // text/comment/attr/PI nodes — it is the correct XPath string-value for all kinds.
  return node.textContent ?? node.nodeValue ?? '';
};
