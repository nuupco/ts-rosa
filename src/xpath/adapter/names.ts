/**
 * Name-related adapter methods for xmldom nodes.
 *
 * No browser globals — all operations go through xmldom's own properties.
 */

type NamedNode = { readonly nodeName: string; readonly namespaceURI: string | null };
type LocalNamedNode = NamedNode & { readonly localName: string };
type PINode = { readonly nodeName: string };

export const getXmldomNamespaceURI = (node: LocalNamedNode): string | null => {
  return node.namespaceURI;
};

export const getXmldomQualifiedName = (node: NamedNode): string => {
  return node.nodeName;
};

export const getXmldomLocalName = (node: LocalNamedNode): string => {
  return node.localName;
};

export const getXmldomProcessingInstructionName = (node: PINode): string => {
  // xmldom ProcessingInstruction.nodeName === target
  return node.nodeName;
};

export const resolveXmldomNamespaceURI = (
  node: { lookupNamespaceURI(prefix: string | null): string | null },
  prefix: string | null
): string | null => {
  return node.lookupNamespaceURI(prefix);
};
