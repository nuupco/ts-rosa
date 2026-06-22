// Multiplicity sentinel constants — faithful to JavaRosa TreeReference.java
// DEFAULT_MULTIPLICITY = 0   (line 49)
// INDEX_UNBOUND        = -1  (line 54)  — wildcard position
// INDEX_TEMPLATE       = -2  (line 62)  — repeat template node
// INDEX_ATTRIBUTE      = -4  (line 67)

export const DEFAULT_MULTIPLICITY = 0;
export const INDEX_UNBOUND = -1;
export const INDEX_TEMPLATE = -2;
export const INDEX_ATTRIBUTE = -4;

export type Multiplicity = number;
