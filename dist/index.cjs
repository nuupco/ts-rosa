'use strict';

var temporalPolyfill = require('temporal-polyfill');
var MD5 = require('crypto-js/md5');
var SHA1 = require('crypto-js/sha1');
var SHA256 = require('crypto-js/sha256');
var SHA384 = require('crypto-js/sha384');
var SHA512 = require('crypto-js/sha512');
var base64 = require('crypto-js/enc-base64');
var hex = require('crypto-js/enc-hex');
var Utf8 = require('crypto-js/enc-utf8');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var MD5__default = /*#__PURE__*/_interopDefault(MD5);
var SHA1__default = /*#__PURE__*/_interopDefault(SHA1);
var SHA256__default = /*#__PURE__*/_interopDefault(SHA256);
var SHA384__default = /*#__PURE__*/_interopDefault(SHA384);
var SHA512__default = /*#__PURE__*/_interopDefault(SHA512);
var base64__namespace = /*#__PURE__*/_interopNamespace(base64);
var hex__namespace = /*#__PURE__*/_interopNamespace(hex);
var Utf8__default = /*#__PURE__*/_interopDefault(Utf8);

var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/model/data/DataType.ts
function dataTypeFromXsdName(xsd) {
  if (xsd === null || xsd === "" || xsd === "xsd:string") return "string";
  switch (xsd) {
    case "xsd:int":
    case "xsd:integer":
      return "int";
    case "xsd:decimal":
      return "decimal";
    case "xsd:boolean":
      return "boolean";
    case "xsd:date":
      return "date";
    case "xsd:time":
      return "time";
    case "xsd:dateTime":
      return "dateTime";
    case "select1":
      return "selectOne";
    case "select":
    case "odk:rank":
      return "selectMulti";
    case "geopoint":
      return "geopoint";
    case "binary":
      return "binary";
    case "xsd:long":
      return "long";
    case "geoshape":
      return "geoshape";
    case "geotrace":
      return "geotrace";
    // NOTE: "uncast" is NOT mapped from any xsd:type attribute.
    // It is an internal intermediary for string-without-type values (mirrors
    // JavaRosa UncastData). It is never produced by dataTypeFromXsdName.
    default:
      return "unsupported";
  }
}

// src/model/data/codecs.ts
function formatDecimal(n) {
  const s = String(n);
  if (!s.includes(".") && !s.includes("e") && !s.includes("E") && s !== "Infinity" && s !== "-Infinity" && s !== "NaN") {
    return s + ".0";
  }
  return s;
}
function formatUtcDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatUtcTime(d) {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min2 = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${h}:${min2}:${sec}.${ms}Z`;
}
function parseGeoPoints(raw) {
  const pointStrs = raw.split(";").map((s) => s.trim()).filter(Boolean);
  if (pointStrs.length === 0) return null;
  const points = [];
  for (const ps of pointStrs) {
    const parts = ps.split(/\s+/);
    if (parts.length < 4) return null;
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    const alt = Number(parts[2]);
    const acc = Number(parts[3]);
    if (isNaN(lat) || isNaN(lon) || isNaN(alt) || isNaN(acc)) return null;
    points.push({ lat, lon, alt, acc });
  }
  return points;
}
function formatGeoPoints(pts) {
  return pts.map(
    (p) => `${formatDecimal(p.lat)} ${formatDecimal(p.lon)} ${formatDecimal(p.alt)} ${formatDecimal(p.acc)}`
  ).join(";");
}
function makeDateRecord(kind, internal, displayText) {
  const stored = new Date(internal.getTime());
  const record = /* @__PURE__ */ Object.create(null);
  record.kind = kind;
  record.displayText = displayText;
  Object.defineProperty(record, "value", {
    get() {
      return new Date(stored.getTime());
    },
    enumerable: true,
    configurable: false
  });
  return record;
}
function cast(type, raw) {
  switch (type) {
    case "string":
      return { kind: "string", value: raw, displayText: raw };
    case "int": {
      if (raw === "") return null;
      const n = parseInt(raw, 10);
      if (isNaN(n)) return null;
      return { kind: "int", value: n, displayText: String(n) };
    }
    case "decimal": {
      if (raw === "") return null;
      const n = Number(raw);
      if (isNaN(n)) return null;
      return { kind: "decimal", value: n, displayText: formatDecimal(n) };
    }
    case "boolean": {
      if (raw === "") return null;
      if (raw !== "1" && raw !== "0") return null;
      const b = raw === "1";
      return { kind: "boolean", value: b, displayText: b ? "True" : "False" };
    }
    case "date": {
      if (raw === "") return null;
      const d = /* @__PURE__ */ new Date(`${raw}T00:00:00.000Z`);
      if (isNaN(d.getTime())) return null;
      return makeDateRecord("date", d, formatUtcDate(d));
    }
    case "time": {
      if (raw === "") return null;
      const d = /* @__PURE__ */ new Date(`1970-01-01T${raw}`);
      if (isNaN(d.getTime())) return null;
      return makeDateRecord("time", d, formatUtcTime(d));
    }
    case "dateTime": {
      if (raw === "") return null;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;
      return makeDateRecord("dateTime", d, d.toISOString());
    }
    case "selectOne": {
      const token = raw.trim();
      if (token === "") return null;
      return { kind: "selectOne", value: token, displayText: token };
    }
    case "selectMulti": {
      const tokens = raw.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return null;
      return { kind: "selectMulti", value: tokens, displayText: tokens.join(" ") };
    }
    case "geopoint": {
      const parts = raw.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const nums = parts.map(Number);
      if (nums.some(isNaN)) return null;
      const lat = nums[0] ?? 0;
      const lon = nums[1] ?? 0;
      const alt = nums[2] ?? 0;
      const acc = nums[3] ?? 0;
      const gp = { lat, lon, alt, acc };
      const len = Math.min(parts.length, 4);
      const allZero = [lat, lon, alt, acc].slice(0, len).every((v) => v === 0);
      const displayParts = [lat, lon, alt, acc].slice(0, len);
      const displayText = allZero ? "" : displayParts.map(formatDecimal).join(" ");
      return { kind: "geopoint", value: gp, displayText };
    }
    case "binary":
      return { kind: "binary", value: raw, displayText: raw };
    case "long": {
      if (raw === "") return null;
      const n = parseInt(raw, 10);
      if (isNaN(n)) return null;
      return { kind: "long", value: n, displayText: String(n) };
    }
    case "geoshape":
    case "geotrace": {
      if (raw === "") return null;
      const points = parseGeoPoints(raw);
      if (points === null) return null;
      return { kind: type, value: points, displayText: formatGeoPoints(points) };
    }
    case "uncast":
      return { kind: "uncast", value: raw, displayText: raw };
    case "unsupported":
      return { kind: "unsupported", value: raw, displayText: raw };
  }
}
function uncast(v) {
  switch (v.kind) {
    case "string":
      return v.value;
    case "int":
      return String(Math.trunc(v.value));
    case "decimal":
      return formatDecimal(v.value);
    // JavaRosa BooleanData.uncast() → "1" (true) | "0" (false)
    case "boolean":
      return v.value ? "1" : "0";
    case "date":
      return formatUtcDate(v.value);
    case "time":
      return formatUtcTime(v.value);
    case "dateTime":
      return v.value.toISOString();
    case "selectOne":
      return v.value;
    case "selectMulti":
      return [...v.value].join(" ");
    case "geopoint":
      return `${formatDecimal(v.value.lat)} ${formatDecimal(v.value.lon)} ${formatDecimal(v.value.alt)} ${formatDecimal(v.value.acc)}`;
    case "binary":
      return v.value;
    case "long":
      return String(Math.trunc(v.value));
    case "geoshape":
      return formatGeoPoints(v.value);
    case "geotrace":
      return formatGeoPoints(v.value);
    case "uncast":
      return v.value;
    case "unsupported":
      return v.value;
  }
}
function stringValue(s) {
  return { kind: "string", value: s, displayText: s };
}
function intValue(n) {
  return { kind: "int", value: n, displayText: String(n) };
}
function decimalValue(n) {
  return { kind: "decimal", value: n, displayText: formatDecimal(n) };
}
function booleanValue(b) {
  return { kind: "boolean", value: b, displayText: b ? "True" : "False" };
}
function dateValue(d) {
  return makeDateRecord("date", d, formatUtcDate(d));
}
function selectOneValue(token) {
  return { kind: "selectOne", value: token, displayText: token };
}
function selectMultiValue(tokens) {
  return { kind: "selectMulti", value: tokens, displayText: [...tokens].join(" ") };
}

// src/model/instance/multiplicity.ts
var DEFAULT_MULTIPLICITY = 0;
var INDEX_UNBOUND = -1;
var INDEX_TEMPLATE = -2;
var INDEX_ATTRIBUTE = -4;

// src/model/instance/TreeReferenceLevel.ts
function level(name2, multiplicity = INDEX_UNBOUND) {
  return Object.freeze({ name: name2, multiplicity, predicates: Object.freeze([]) });
}

// src/model/instance/TreeReference.ts
var REF_ABSOLUTE = -1;
function makeRef(refLevel, contextType, levels, instanceName = null) {
  return Object.freeze({ refLevel, contextType, instanceName, levels: Object.freeze([...levels]) });
}
function rootRef() {
  return makeRef(REF_ABSOLUTE, "absolute", []);
}
function selfRef() {
  return makeRef(0, "original", []);
}
function extendRef(ref, name2, mult) {
  const newLevel = level(name2, mult ?? INDEX_UNBOUND);
  return makeRef(ref.refLevel, ref.contextType, [...ref.levels, newLevel], ref.instanceName);
}
function parentOf(ref) {
  return makeRef(ref.refLevel, ref.contextType, ref.levels.slice(0, -1), ref.instanceName);
}
function genericize(ref) {
  const genericLevels = ref.levels.map(
    (lvl) => level(lvl.name, INDEX_UNBOUND)
  );
  return makeRef(ref.refLevel, ref.contextType, genericLevels, ref.instanceName);
}
function contextualize(ref, context) {
  const combined = [...context.levels, ...ref.levels];
  return makeRef(REF_ABSOLUTE, "absolute", combined, context.instanceName);
}
function refEquals(a, b) {
  if (a.refLevel !== b.refLevel) return false;
  if (a.contextType !== b.contextType) return false;
  if (a.instanceName !== b.instanceName) return false;
  if (a.levels.length !== b.levels.length) return false;
  for (let i = 0; i < a.levels.length; i++) {
    if (a.levels[i].name !== b.levels[i].name) return false;
    if (a.levels[i].multiplicity !== b.levels[i].multiplicity) return false;
  }
  return true;
}
function refToString(ref) {
  if (ref.levels.length === 0) return ref.refLevel === REF_ABSOLUTE ? "/" : ".";
  const segments = ref.levels.map((lvl) => {
    const mult = lvl.multiplicity >= 0 ? `[${lvl.multiplicity}]` : "";
    return `${lvl.name}${mult}`;
  });
  return (ref.refLevel === REF_ABSOLUTE ? "/" : "") + segments.join("/");
}
function parseAbsoluteRef(path) {
  const parts = path.split("/").filter((s) => s.length > 0);
  const levels = parts.map((part) => {
    const bracketIdx = part.indexOf("[");
    if (bracketIdx !== -1) {
      const name2 = part.slice(0, bracketIdx);
      const body = part.slice(bracketIdx + 1, part.length - 1);
      if (!/^[0-9]+$/.test(body)) {
        throw new Error(
          `TreeReference: unsupported predicate '[${body}]' in ref '${path}' \u2014 only positive integer positions are supported`
        );
      }
      const pos = parseInt(body, 10);
      return level(name2, pos - 1);
    }
    return level(part, INDEX_UNBOUND);
  });
  return makeRef(REF_ABSOLUTE, "absolute", levels);
}

// src/model/instance/InstanceNode.ts
function getAttribute(node, name2) {
  return node.attributes?.get(name2);
}
function setAttribute(node, name2, value) {
  (node.attributes ??= /* @__PURE__ */ new Map()).set(name2, value);
}
function deleteAttribute(node, name2) {
  node.attributes?.delete(name2);
}
function attributeNames(node) {
  return node.attributes === null ? [] : Array.from(node.attributes.keys());
}
function newNode(name2, opts) {
  return {
    name: name2,
    multiplicity: opts?.multiplicity ?? DEFAULT_MULTIPLICITY,
    value: opts?.value ?? null,
    children: [],
    attributes: null,
    dataType: opts?.dataType ?? "string",
    parent: null
  };
}
function appendChild(parent, child) {
  child.parent = parent;
  if (child.multiplicity !== INDEX_TEMPLATE) {
    const sameNameCount = parent.children.filter(
      (c) => c.name === child.name && c.multiplicity !== INDEX_TEMPLATE
    ).length;
    child.multiplicity = sameNameCount;
  }
  parent.children.push(child);
}
function childrenNamed(node, name2) {
  return node.children.filter((c) => c.name === name2);
}
function realChildrenNamed(node, name2) {
  const result = [];
  for (const child of node.children) {
    if (child.name === name2 && child.multiplicity !== INDEX_TEMPLATE) {
      result.push(child);
    }
  }
  return result;
}
function nthRealChildNamed(node, name2, index) {
  if (index < 0) return null;
  let count2 = 0;
  for (const child of node.children) {
    if (child.name === name2 && child.multiplicity !== INDEX_TEMPLATE) {
      if (count2 === index) return child;
      count2++;
    }
  }
  return null;
}
function cloneNode(source) {
  const clone = {
    name: source.name,
    multiplicity: DEFAULT_MULTIPLICITY,
    value: source.value,
    children: [],
    attributes: source.attributes === null ? null : new Map(source.attributes),
    dataType: source.dataType,
    parent: null
  };
  for (const child of source.children) {
    const childClone = cloneNode(child);
    childClone.parent = clone;
    if (child.multiplicity === INDEX_TEMPLATE) {
      childClone.multiplicity = INDEX_TEMPLATE;
    } else {
      const sameNameCount = clone.children.filter(
        (c) => c.name === childClone.name && c.multiplicity !== INDEX_TEMPLATE
      ).length;
      childClone.multiplicity = sameNameCount;
    }
    clone.children.push(childClone);
  }
  return clone;
}

// src/model/instance/InstanceTree.ts
function resolveReference(tree, ref) {
  if (ref.levels.length === 0) return tree.root;
  const [firstLevel, ...restLevels] = ref.levels;
  if (firstLevel === void 0) return tree.root;
  if (tree.root.name !== firstLevel.name && firstLevel.name !== "*") return null;
  let node = tree.root;
  for (const lvl of restLevels) {
    const idx = lvl.multiplicity === INDEX_UNBOUND ? DEFAULT_MULTIPLICITY : lvl.multiplicity;
    const next = nthRealChildNamed(node, lvl.name, idx);
    if (next === null) return null;
    node = next;
  }
  return node;
}
function resolveAllWithin(tree, subtreeRoot, ref) {
  let depth = 0;
  let cur = subtreeRoot;
  while (cur.parent !== null) {
    depth++;
    cur = cur.parent;
  }
  if (ref.levels.length <= depth) return resolveAll(tree, ref);
  const anchorLevel = ref.levels[depth];
  if (anchorLevel.name !== subtreeRoot.name && anchorLevel.name !== "*") return resolveAll(tree, ref);
  for (let i = 0; i < depth; i++) {
    const rl = ref.levels[i];
    if (rl.multiplicity !== INDEX_UNBOUND) return resolveAll(tree, ref);
  }
  const suffixLevels = ref.levels.slice(depth + 1);
  if (suffixLevels.length === 0) {
    return [subtreeRoot];
  }
  let currentNodes = [subtreeRoot];
  for (const lvl of suffixLevels) {
    const nextNodes = [];
    for (const node of currentNodes) {
      if (lvl.multiplicity === INDEX_UNBOUND) {
        nextNodes.push(...realChildrenNamed(node, lvl.name));
      } else {
        const match = nthRealChildNamed(node, lvl.name, lvl.multiplicity);
        if (match !== null) nextNodes.push(match);
      }
    }
    currentNodes = nextNodes;
  }
  return currentNodes;
}
function resolveAllContextualized(tree, ref, changedRef) {
  const refLevels = ref.levels;
  const changedLevels = changedRef.levels;
  const minLen = Math.min(refLevels.length, changedLevels.length);
  let anchorDepth = -1;
  for (let i = 0; i < minLen; i++) {
    const rl = refLevels[i];
    const cl = changedLevels[i];
    if (rl.name !== cl.name) break;
    if (cl.multiplicity !== INDEX_UNBOUND) {
      anchorDepth = i;
    }
  }
  if (anchorDepth < 0) {
    return resolveAll(tree, ref);
  }
  for (let i = 1; i <= anchorDepth; i++) {
    if (changedLevels[i].multiplicity === INDEX_UNBOUND) {
      return resolveAll(tree, ref);
    }
  }
  for (let i = 1; i <= anchorDepth; i++) {
    if (i < refLevels.length && refLevels[i].multiplicity !== INDEX_UNBOUND) {
      return resolveAll(tree, ref);
    }
  }
  const anchorLevels = changedLevels.slice(0, anchorDepth + 1);
  let anchorNode = tree.root;
  if (anchorLevels.length === 0) {
    anchorNode = tree.root;
  } else {
    const [first, ...rest] = anchorLevels;
    if (first === void 0 || tree.root.name !== first.name && first.name !== "*") {
      return resolveAll(tree, ref);
    }
    anchorNode = tree.root;
    for (const lvl of rest) {
      const idx = lvl.multiplicity === INDEX_UNBOUND ? DEFAULT_MULTIPLICITY : lvl.multiplicity;
      const next = nthRealChildNamed(anchorNode, lvl.name, idx);
      if (next === null) return [];
      anchorNode = next;
    }
  }
  if (anchorNode === null) return resolveAll(tree, ref);
  const suffixLevels = refLevels.slice(anchorDepth + 1);
  if (suffixLevels.length === 0) {
    return [anchorNode];
  }
  let currentNodes = [anchorNode];
  for (const lvl of suffixLevels) {
    const nextNodes = [];
    for (const node of currentNodes) {
      if (lvl.multiplicity === INDEX_UNBOUND) {
        nextNodes.push(...realChildrenNamed(node, lvl.name));
      } else {
        const match = nthRealChildNamed(node, lvl.name, lvl.multiplicity);
        if (match !== null) nextNodes.push(match);
      }
    }
    currentNodes = nextNodes;
  }
  return currentNodes;
}
function resolveAll(tree, ref) {
  if (ref.levels.length === 0) return [tree.root];
  const [firstLevel, ...restLevels] = ref.levels;
  if (firstLevel === void 0) return [tree.root];
  if (tree.root.name !== firstLevel.name && firstLevel.name !== "*") return [];
  let currentNodes = [tree.root];
  for (const lvl of restLevels) {
    const nextNodes = [];
    for (const node of currentNodes) {
      if (lvl.multiplicity === INDEX_UNBOUND) {
        nextNodes.push(...realChildrenNamed(node, lvl.name));
      } else {
        const match = nthRealChildNamed(node, lvl.name, lvl.multiplicity);
        if (match !== null) nextNodes.push(match);
      }
    }
    currentNodes = nextNodes;
  }
  return currentNodes;
}
function addRepeatInstance(tree, ref) {
  if (ref.levels.length === 0) return null;
  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1];
  let parent = resolveReference(tree, parentRef);
  if (parent === null && parentRef.levels.length > 0) {
    const gpRef = { ...parentRef, levels: parentRef.levels.slice(0, -1) };
    const gp = resolveReference(tree, gpRef);
    if (gp !== null) {
      const parentName = parentRef.levels[parentRef.levels.length - 1].name;
      const candidates = gp.children.filter(
        (c) => c.name === parentName && c.multiplicity !== INDEX_TEMPLATE
      );
      parent = candidates[0] ?? null;
    }
  }
  if (parent === null) return null;
  const templateNode = parent.children.find(
    (c) => c.name === lastLevel.name && c.multiplicity === INDEX_TEMPLATE
  ) ?? null;
  const instances = parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE
  );
  const source = templateNode ?? instances[0];
  if (source === void 0) return null;
  const clone = cloneNode(source);
  clone.multiplicity = instances.length;
  clone.parent = parent;
  clearValues(clone);
  parent.children.push(clone);
  return clone;
}
function clearValues(node) {
  node.value = null;
  for (const child of node.children) {
    clearValues(child);
  }
}
function removeRepeatInstance(tree, ref) {
  if (ref.levels.length === 0) return null;
  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1];
  const targetMultiplicity = lastLevel.multiplicity;
  const parent = resolveReference(tree, parentRef);
  if (parent === null) return null;
  const instances = parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE
  );
  const target = targetMultiplicity >= 0 ? instances[targetMultiplicity] : null;
  if (target === null || target === void 0) return null;
  const childIdx = parent.children.indexOf(target);
  if (childIdx === -1) return null;
  parent.children.splice(childIdx, 1);
  target.parent = null;
  let idx = 0;
  for (const child of parent.children) {
    if (child.name === lastLevel.name && child.multiplicity !== INDEX_TEMPLATE) {
      child.multiplicity = idx++;
    }
  }
  return target;
}
function countRepeatInstances(tree, ref) {
  if (ref.levels.length === 0) return 0;
  const parentRef = { ...ref, levels: ref.levels.slice(0, -1) };
  const lastLevel = ref.levels[ref.levels.length - 1];
  const parent = resolveReference(tree, parentRef);
  if (parent === null) return 0;
  return parent.children.filter(
    (c) => c.name === lastLevel.name && c.multiplicity !== INDEX_TEMPLATE
  ).length;
}

// src/model/def/controlType.ts
function controlTypeFromTag(localName2) {
  switch (localName2) {
    case "input":
      return "input";
    case "select1":
      return "select1";
    case "select":
      return "select";
    case "rank":
      return "rank";
    case "trigger":
      return "trigger";
    case "upload":
      return "upload";
    case "range":
      return "range";
    case "secret":
      return "secret";
    default:
      return "unknown";
  }
}

// src/model/def/FormDefinition.ts
function walkControls(def, visitor) {
  function walk(elements) {
    for (const el of elements) {
      if (el.kind === "question") {
        visitor(el);
      } else {
        walk(el.children);
      }
    }
  }
  walk(def.body);
}

// src/platform/XmlParser.ts
var _provider = null;
function registerXmlParser(provider) {
  _provider = provider;
}
function getXmlParser() {
  if (_provider === null) {
    throw new Error(
      "XmlParser provider is not registered. Call registerXmlParser() before parsing XML. In tests, wire the provider in tests/setup.ts via setupFiles."
    );
  }
  return _provider;
}
var Temporal = globalThis.Temporal ?? temporalPolyfill.Temporal;

// src/xpath/vendor/xpath/adapter/xpathDOMProvider.ts
var extendNodeKindGuards = (base) => {
  const assertXPathNode = (value, message = "Invalid context node") => {
    if (!base.isXPathNode(value)) {
      throw new Error(message);
    }
  };
  const isParentNode = (value) => {
    const kind = base.getNodeKind(value);
    return kind === "document" || kind === "element";
  };
  const extensions = {
    assertXPathNode,
    assertParentNode: (value, message = "Invalid parent node") => {
      assertXPathNode(value);
      if (!isParentNode(value)) {
        throw new Error(message);
      }
    },
    isDocument: (node) => {
      return base.getNodeKind(node) === "document";
    },
    isElement: (node) => {
      return base.getNodeKind(node) === "element";
    },
    isNamespaceDeclaration: (node) => {
      return base.getNodeKind(node) === "namespace_declaration";
    },
    isAttribute: (node) => {
      return base.getNodeKind(node) === "attribute";
    },
    isText: (node) => {
      return base.getNodeKind(node) === "text";
    },
    isComment: (node) => {
      return base.getNodeKind(node) === "comment";
    },
    isProcessingInstruction: (node) => {
      return base.getNodeKind(node) === "processing_instruction";
    },
    isParentNode,
    isQualifiedNamedNode: (node) => {
      const kind = base.getNodeKind(node);
      return kind === "element" || kind === "attribute";
    }
  };
  return Object.assign(base, extensions);
};
var getElementByUniqueIdFactory = (adapter, getNamedAttributeValue) => {
  const adapterImplementation = adapter.getElementByUniqueId?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  const getElementByUniqueId = (node, id2) => {
    if (adapter.isElement(node) && getNamedAttributeValue(node, "id") === id2) {
      return node;
    }
    for (const childElement of adapter.getChildElements(node)) {
      const element = getElementByUniqueId(childElement, id2);
      if (element != null) {
        return element;
      }
    }
    return null;
  };
  return getElementByUniqueId;
};
var getQualifiedNamedAttributeValueFactory = (adapter) => {
  const adapterImplementation = adapter.getQualifiedNamedAttributeValue?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node, namespaceURI2, localName2) => {
    const attributes = adapter.getAttributes(node);
    for (const attribute of attributes) {
      if (adapter.getNamespaceURI(attribute) === namespaceURI2 && adapter.getLocalName(attribute) === localName2) {
        return adapter.getNodeValue(attribute);
      }
    }
    return null;
  };
};
var getLocalNamedAttributeValueFactory = (adapter) => {
  const adapterImplementation = adapter.getLocalNamedAttributeValue?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node, localName2) => {
    const attributes = adapter.getAttributes(node);
    for (const attribute of attributes) {
      if (adapter.getLocalName(attribute) === localName2) {
        return adapter.getNodeValue(attribute);
      }
    }
    return null;
  };
};
var hasLocalNamedAttributeFactory = (adapter, lookup) => {
  const adapterImplementation = adapter.hasLocalNamedAttribute?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node, localName2) => {
    return lookup(node, localName2) != null;
  };
};
var getChildrenByLocalNameFactory = (adapter) => {
  const adapterImplementation = adapter.getChildrenByLocalName?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node, localName2) => {
    return adapter.getChildElements(node).filter((element) => {
      return adapter.getLocalName(element) === localName2;
    });
  };
};
var getFirstChildNodeFactory = (adapter) => {
  const adapterImplementation = adapter.getFirstChildNode?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node) => {
    const [childNode] = adapter.getChildNodes(node);
    return childNode ?? null;
  };
};
var getLastChildNodeFactory = (adapter) => {
  const adapterImplementation = adapter.getLastChildNode?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node) => {
    return Array.from(adapter.getChildNodes(node)).at(-1) ?? null;
  };
};
var getFirstChildElementFactory = (adapter) => {
  const adapterImplementation = adapter.getFirstChildElement?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node) => {
    const [childElement] = adapter.getChildElements(node);
    return childElement ?? null;
  };
};
var getLastChildElementFactory = (adapter) => {
  const adapterImplementation = adapter.getLastChildElement?.bind(adapter);
  if (adapterImplementation != null) {
    return adapterImplementation;
  }
  return (node) => {
    return adapter.getChildElements(node).at(-1) ?? null;
  };
};
var extendOptimizableOperations = (base) => {
  const getLocalNamedAttributeValue = getLocalNamedAttributeValueFactory(base);
  const extensions = {
    getElementByUniqueId: getElementByUniqueIdFactory(base, getLocalNamedAttributeValue),
    getQualifiedNamedAttributeValue: getQualifiedNamedAttributeValueFactory(base),
    getLocalNamedAttributeValue,
    hasLocalNamedAttribute: hasLocalNamedAttributeFactory(base, getLocalNamedAttributeValue),
    getChildrenByLocalName: getChildrenByLocalNameFactory(base),
    getFirstChildNode: getFirstChildNodeFactory(base),
    getFirstChildElement: getFirstChildElementFactory(base),
    getLastChildNode: getLastChildNodeFactory(base),
    getLastChildElement: getLastChildElementFactory(base)
  };
  return Object.assign(base, extensions);
};
var DERIVED_DOM_PROVIDER = /* @__PURE__ */ Symbol("DERIVED_DOM_PROVIDER");
var derivedDOMProvider = (base) => {
  return Object.assign({}, base, {
    [DERIVED_DOM_PROVIDER]: true
  });
};
var isXPathDOMProvider = (adapter) => {
  return DERIVED_DOM_PROVIDER in adapter && adapter[DERIVED_DOM_PROVIDER] === true;
};
var xpathDOMProvider = (adapter) => {
  if (isXPathDOMProvider(adapter)) {
    console.warn(
      "Repeat call to xpathDOMProvider: provider has already been derived from provided adapter"
    );
    return adapter;
  }
  const extendedGuards = extendNodeKindGuards(adapter);
  const exended = extendOptimizableOperations(extendedGuards);
  return derivedDOMProvider(exended);
};

// src/xpath/vendor/common/lib/error/UnreachableError.ts
var UnreachableError = class extends Error {
  constructor(unrechable, additionalDetail) {
    let message = `Unreachable value: ${JSON.stringify(unrechable)}`;
    if (additionalDetail != null) {
      message = `${message} (${additionalDetail})`;
    }
    super(message);
  }
};

// src/xpath/vendor/common/lib/string/whitespace.ts
var XML_XPATH_WHITESPACE_SUBPATTERN = "[\\x20\\x09\\x0D\\x0A]";
var XML_XPATH_WHITESPACE_PATTERN = new RegExp(XML_XPATH_WHITESPACE_SUBPATTERN, "g");
var XML_XPATH_LEADING_TRAILING_WHITESPACE_PATTERN = new RegExp(
  `^${XML_XPATH_WHITESPACE_SUBPATTERN}+|${XML_XPATH_WHITESPACE_SUBPATTERN}+$`,
  "g"
);
var XPATH_REPEATING_WHITESPACE_PATTERN = new RegExp(
  `${XML_XPATH_WHITESPACE_SUBPATTERN}{2,}`,
  "g"
);
var trimXMLXPathWhitespace = (value) => value.replaceAll(XML_XPATH_LEADING_TRAILING_WHITESPACE_PATTERN, "");
var normalizeXMLXPathWhitespace = (value) => trimXMLXPathWhitespace(value).replaceAll(XPATH_REPEATING_WHITESPACE_PATTERN, " ");
var xmlXPathWhitespaceSeparatedList = (value, options) => {
  return normalizeXMLXPathWhitespace(value).split(XML_XPATH_WHITESPACE_PATTERN);
};

// src/xpath/vendor/xpath/evaluations/ValueEvaluation.ts
var ValueEvaluation = class {
  _values = [this];
  [Symbol.iterator]() {
    return this.values().values();
  }
  first() {
    return this;
  }
  values() {
    return this._values;
  }
  toBoolean() {
    return this.booleanValue;
  }
  toNumber() {
    return this.numberValue;
  }
  toString() {
    return this.stringValue;
  }
  eq(operand) {
    if (this.type === "BOOLEAN") {
      return this.toBoolean() === operand.toBoolean();
    }
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.eq(rhs));
    }
    if (this.type === "NODE") {
      switch (operand.type) {
        case "BOOLEAN":
          return this.toBoolean() === operand.toBoolean();
        case "NUMBER":
          return this.toNumber() === operand.toNumber();
        case "NODE":
        case "STRING":
          return this.toString() === operand.toString();
        default:
          throw new UnreachableError(operand.type);
      }
    }
    if (operand.type === "NODE") {
      return operand.eq(this);
    }
    if (this.type === "BOOLEAN" || operand.type === "BOOLEAN") {
      return this.toBoolean() === operand.toBoolean();
    }
    if (this.type === "NUMBER" || operand.type === "NUMBER") {
      const a = this.toNumber();
      const b = operand.toNumber();
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return false;
      }
      return Math.abs(a - b) <= 1e-12;
    }
    return this.toString() === operand.toString();
  }
  ne(operand) {
    if (this.type === "BOOLEAN") {
      return this.toBoolean() !== operand.toBoolean();
    }
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.ne(rhs));
    }
    return !this.eq(operand);
  }
  lt(operand) {
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.lt(rhs));
    }
    return this.toNumber() < operand.toNumber();
  }
  lte(operand) {
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.lte(rhs));
    }
    return this.toNumber() <= operand.toNumber();
  }
  gt(operand) {
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.gt(rhs));
    }
    return this.toNumber() > operand.toNumber();
  }
  gte(operand) {
    if (operand instanceof LocationPathEvaluation) {
      return operand.some((rhs) => this.gte(rhs));
    }
    return this.toNumber() >= operand.toNumber();
  }
};

// src/xpath/vendor/xpath/evaluations/StringEvaluation.ts
var JAVAROSA_NUMBER_RE = /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/;
var javarosaParseNumber = (value) => {
  if (!JAVAROSA_NUMBER_RE.test(value)) {
    return NaN;
  }
  return Number(value);
};
var StringEvaluation = class extends ValueEvaluation {
  constructor(context, value, isEmpty = value === "") {
    super();
    this.context = context;
    this.value = value;
    this.isEmpty = isEmpty;
    this.booleanValue = !isEmpty;
    this.stringValue = value;
    if (isEmpty) {
      this.numberValue = NaN;
    } else {
      this.numberValue = javarosaParseNumber(value);
      const numberFunction = context.functions.getDefaultImplementation("number");
      if (numberFunction != null) {
        this.numberValue = numberFunction.call(context, [
          {
            evaluate: () => this
          }
        ]).toNumber();
      }
    }
  }
  context;
  value;
  isEmpty;
  type = "STRING";
  nodes = null;
  booleanValue;
  numberValue;
  stringValue;
};

// src/xpath/vendor/xpath/evaluations/NodeEvaluation.ts
var NodeEvaluation = class extends ValueEvaluation {
  constructor(context, value) {
    super();
    this.context = context;
    this.value = value;
  }
  context;
  value;
  type = "NODE";
  // PERF (ts-rosa-original): each of nodes/stringValue/numberValue/isEmpty is
  // computed lazily and cached independently, rather than eagerly computing
  // all four together on first access (as an upstream single computeValues()
  // pass did). Most XPath comparisons only ever read one of these — e.g.
  // ValueEvaluation.eq() for a NODE-vs-STRING comparison (the common
  // itemset choice_filter shape: item[col = 'literal']) only calls
  // toString(), never toNumber() — so eagerly computing numberValue
  // (a function-registry lookup + StringEvaluation construction) for
  // every context node visited during a predicate scan was pure waste.
  // At hundreds of thousands of nodes (e.g. a large CSV secondary
  // instance filtered by a single-select), that waste dominated the
  // evaluation cost of the whole expression.
  _nodes;
  _stringValue;
  _isEmpty;
  _numberValue;
  get nodes() {
    let nodes = this._nodes;
    if (nodes === void 0) {
      nodes = /* @__PURE__ */ new Set([this.value]);
      this._nodes = nodes;
    }
    return nodes;
  }
  getStringValue() {
    let stringValue2 = this._stringValue;
    if (stringValue2 === void 0) {
      stringValue2 = this.context.domProvider.getNodeValue(this.value);
      this._stringValue = stringValue2;
    }
    return stringValue2;
  }
  getIsEmpty() {
    let isEmpty = this._isEmpty;
    if (isEmpty === void 0) {
      isEmpty = trimXMLXPathWhitespace(this.getStringValue()) === "";
      this._isEmpty = isEmpty;
    }
    return isEmpty;
  }
  get booleanValue() {
    return !this.getIsEmpty();
  }
  get numberValue() {
    let numberValue = this._numberValue;
    if (numberValue === void 0) {
      numberValue = this.computeNumberValue();
      this._numberValue = numberValue;
    }
    return numberValue;
  }
  get stringValue() {
    return this.getStringValue();
  }
  get isEmpty() {
    return this.getIsEmpty();
  }
  computeNumberValue() {
    const { context } = this;
    if (this.getIsEmpty()) {
      return NaN;
    }
    const numberFunction = context.functions.getDefaultImplementation("number");
    if (numberFunction == null) {
      return Number(this.getStringValue());
    }
    const stringEvaluation = new StringEvaluation(context, this.getStringValue());
    return numberFunction.call(context, [
      {
        evaluate: () => stringEvaluation
      }
    ]).toNumber();
  }
};

// src/xpath/vendor/xpath/evaluations/LocationPathEvaluation.ts
var anyNodeTypePredicate = (_) => true;
var getNodeTypePredicate = (domProvider, step) => {
  switch (step.axisType) {
    case "attribute":
      return domProvider.isAttribute;
    case "namespace":
      return domProvider.isNamespaceDeclaration;
  }
  switch (step.nodeType) {
    case "__NAMED__":
      return domProvider.isQualifiedNamedNode;
    case "processing-instruction":
      return domProvider.isProcessingInstruction;
    case "comment":
      return domProvider.isComment;
    case "node":
      return anyNodeTypePredicate;
    case "text":
      return domProvider.isText;
    default:
      throw new UnreachableError(step);
  }
};
var axisEvaluationContext = (currentContext, contextNode) => {
  const { domProvider, contextDocument, rootNode, visited } = currentContext;
  return {
    domProvider,
    contextDocument,
    rootNode,
    contextNode,
    visited
  };
};
var siblings = (context, methodName) => {
  const method = context.domProvider[methodName];
  const results = [];
  let currentNode = context.contextNode;
  while (currentNode != null) {
    currentNode = method(currentNode);
    if (currentNode != null) {
      results.push(currentNode);
    }
  }
  return results;
};
var getDocumentOrderTraversalContextNode = (domProvider, contextNode) => {
  if (domProvider.isAttribute(contextNode) || domProvider.isNamespaceDeclaration(contextNode)) {
    const parentElement = domProvider.getParentNode(contextNode);
    domProvider.assertParentNode(parentElement);
    return parentElement;
  }
  return contextNode;
};
var documentRootPrecedingSiblings = (domAdapter, precedingContext, documentRoot, step) => {
  const documentRootContext = axisEvaluationContext(precedingContext, documentRoot);
  const precedingSiblings = axisEvaluators["preceding-sibling"](documentRootContext, step);
  return precedingSiblings.flatMap((node) => {
    try {
      if (domAdapter.getNodeKind(node) != null) {
        return node;
      }
      return [];
    } catch {
      return [];
    }
  });
};
var axisEvaluators = {
  ancestor: (context, step) => {
    const { rootNode, contextNode } = context;
    if (contextNode === rootNode) {
      return [];
    }
    return axisEvaluators.parent(context).flatMap((parentNode) => {
      const parentContext = axisEvaluationContext(context, parentNode);
      return [...axisEvaluators.ancestor(parentContext, step), parentNode];
    });
  },
  "ancestor-or-self": (context, step) => {
    const { contextNode } = context;
    const isNamedStep = step.stepType !== "NodeTypeTest";
    const currentContext = axisEvaluationContext(context, contextNode);
    const ancestors = axisEvaluators.ancestor(currentContext, step);
    if (!isNamedStep || context.domProvider.isElement(contextNode)) {
      return ancestors.concat(contextNode);
    }
    return ancestors;
  },
  attribute: (context) => {
    return context.domProvider.getAttributes(context.contextNode);
  },
  child: (context, step) => {
    const { contextNode, domProvider } = context;
    if (step.nodeType === "__NAMED__") {
      return domProvider.getChildElements(contextNode);
    }
    return domProvider.getChildNodes(contextNode);
  },
  descendant: (context, step) => {
    return axisEvaluators.child(context, step).flatMap((childNode) => {
      const childContext = axisEvaluationContext(context, childNode);
      return [childNode, ...axisEvaluators.descendant(childContext, step)];
    });
  },
  "descendant-or-self": (context, step) => {
    return [context.contextNode].concat(axisEvaluators.descendant(context, step));
  },
  following: (context, step) => {
    const { domProvider, contextDocument, rootNode } = context;
    const contextNode = getDocumentOrderTraversalContextNode(domProvider, context.contextNode);
    if (context.visited.has(contextNode)) {
      return [];
    }
    context.visited.add(contextNode);
    const parentNode = domProvider.getParentNode(contextNode);
    if (contextNode === rootNode || parentNode === contextDocument) {
      return [];
    }
    let firstChild;
    let nextSibling;
    if (step.nodeType === "__NAMED__") {
      firstChild = domProvider.getFirstChildElement(contextNode);
      nextSibling = domProvider.getNextSiblingElement(contextNode);
    } else {
      firstChild = domProvider.getFirstChildNode(contextNode);
      nextSibling = domProvider.getNextSiblingNode(contextNode);
    }
    let currentNodes = [firstChild, nextSibling].filter((node) => node != null);
    if (parentNode != null && parentNode !== rootNode) {
      const followingParentSiblingsContext = axisEvaluationContext(context, parentNode);
      const followingParentSiblings = axisEvaluators["following-sibling"](
        followingParentSiblingsContext,
        step
      );
      currentNodes = currentNodes.concat(followingParentSiblings);
    }
    return currentNodes.flatMap((currentNode) => {
      const currentContext = axisEvaluationContext(context, currentNode);
      return [currentNode].concat(axisEvaluators.following(currentContext, step));
    });
  },
  "following-sibling": (context, step) => {
    if (step.nodeType === "__NAMED__") {
      return siblings(context, "getNextSiblingElement");
    }
    return siblings(context, "getNextSiblingNode");
  },
  namespace: (context) => {
    return context.domProvider.getNamespaceDeclarations(context.contextNode);
  },
  parent: (context) => {
    const { rootNode, contextNode } = context;
    if (contextNode === rootNode) {
      return [];
    }
    const parentNode = context.domProvider.getParentNode(contextNode);
    if (parentNode != null) {
      return [parentNode];
    }
    return [];
  },
  preceding: (context, step) => {
    const { domProvider, rootNode, contextDocument, visited } = context;
    const contextNode = getDocumentOrderTraversalContextNode(domProvider, context.contextNode);
    if (visited.has(contextNode)) {
      return [];
    }
    visited.add(contextNode);
    if (contextNode === rootNode) {
      return [];
    }
    const parentNode = domProvider.getParentNode(contextNode);
    if (parentNode === contextDocument) {
      return documentRootPrecedingSiblings(domProvider, context, contextNode, step);
    }
    let lastChild;
    let previousSibling;
    if (step.nodeType === "__NAMED__") {
      previousSibling = domProvider.getPreviousSiblingElement(contextNode);
      lastChild = domProvider.getLastChildElement(contextNode);
    } else {
      previousSibling = domProvider.getPreviousSiblingNode(contextNode);
      lastChild = domProvider.getLastChildNode(contextNode);
    }
    if (lastChild === contextNode) {
      lastChild = null;
    }
    let currentNodes = [lastChild, previousSibling].filter((node) => node != null);
    if (contextNode !== rootNode && parentNode != null && parentNode !== rootNode) {
      const precedingParentSiblingsContext = axisEvaluationContext(context, parentNode);
      const precedingParentSiblings = axisEvaluators["preceding-sibling"](
        precedingParentSiblingsContext,
        step
      );
      currentNodes = currentNodes.concat(precedingParentSiblings);
    }
    return currentNodes.flatMap((currentNode) => {
      const currentContext = axisEvaluationContext(context, currentNode);
      return [currentNode].concat(axisEvaluators.preceding(currentContext, step));
    });
  },
  "preceding-sibling": (context, step) => {
    if (step.nodeType === "__NAMED__") {
      return siblings(context, "getPreviousSiblingElement");
    }
    return siblings(context, "getPreviousSiblingNode");
  },
  self: (context) => {
    return [context.contextNode];
  }
};
var LocationPathEvaluation = class _LocationPathEvaluation {
  constructor(parentContext, contextNodes, options = {}) {
    this.parentContext = parentContext;
    this.contextNodes = contextNodes;
    this.domProvider = parentContext.domProvider;
    const {
      evaluator,
      contextDocument,
      evaluationContextNode,
      functions: functions2,
      namespaceResolver,
      rootNode,
      timeZone
    } = parentContext;
    this.evaluator = evaluator;
    this.contextDocument = contextDocument;
    this.evaluationContextNode = evaluationContextNode;
    this.functions = functions2;
    this.namespaceResolver = namespaceResolver;
    this.rootNode = rootNode;
    this.timeZone = timeZone;
    this.nodes = contextNodes;
    this.computedContextSize = options.contextSize ?? contextNodes.size;
    this.initializedContextPosition = options.contextPosition ?? 1;
  }
  parentContext;
  contextNodes;
  static isInstance(context, value) {
    return value instanceof _LocationPathEvaluation && value.domProvider === context.domProvider;
  }
  static assertInstance = (context, value, message) => {
    if (!this.isInstance(context, value)) {
      throw new Error(message ?? "Expected a node-set result");
    }
  };
  // --- DOM adapter/provider ---
  domProvider;
  // --- Evaluation ---
  type = "NODE";
  // PERF (ts-rosa-original): lazily computed and cached on first access,
  // rather than eagerly built in the constructor. `[Symbol.iterator]`
  // constructs one single-node LocationPathEvaluation per context node
  // while stepping through a location path (e.g. per row when filtering a
  // large secondary instance by a predicate) — most of those intermediate,
  // single-node wrappers only ever need `contextNodes` to take the next
  // step and never touch `nodeEvaluations` at all. At hundreds of
  // thousands of context nodes, skipping the unused Array.from().map()
  // (and the NodeEvaluation objects it built) for every intermediate
  // wrapper was the dominant cost of evaluating such a predicate.
  _nodeEvaluations;
  get nodeEvaluations() {
    let nodeEvaluations = this._nodeEvaluations;
    if (nodeEvaluations === void 0) {
      nodeEvaluations = Array.from(this.contextNodes).map((node) => {
        return new NodeEvaluation(this, node);
      });
      this._nodeEvaluations = nodeEvaluations;
    }
    return nodeEvaluations;
  }
  // --- Context ---
  evaluator;
  context = this;
  /**
   * @see {@link Context.evaluationContextNode}
   */
  evaluationContextNode;
  contextDocument;
  rootNode;
  nodes;
  computedContextSize;
  initializedContextPosition;
  functions;
  namespaceResolver;
  timeZone;
  /**
   * TODO: this is a temporary accommodation for these cases which are presently
   * not especially well designed:
   *
   * - Functions returning node-sets (i.e. {@link NodeSetFunction} instances).
   *   It may make sense to invert control, invoking them from here?
   *
   * - Nodes filtered by predicate in {@link LocationPathExpression}. Such
   *   filtering almost certainly should be performed here, in {@link step}.
   */
  static fromArbitraryNodes(currentContext, nodes, _temporaryCallee) {
    return new this(currentContext, new Set(nodes));
  }
  static fromCurrentContext(evaluationContext) {
    if (_LocationPathEvaluation.isInstance(evaluationContext, evaluationContext)) {
      return evaluationContext;
    }
    return new this(evaluationContext, evaluationContext.contextNodes);
  }
  static fromRoot(parentContext) {
    return new this(parentContext, /* @__PURE__ */ new Set([parentContext.rootNode]));
  }
  [Symbol.iterator]() {
    const nodes = this.contextNodes[Symbol.iterator]();
    const contextSize = this.contextSize();
    let contextPosition = this.contextPosition();
    return {
      next: () => {
        const next = nodes.next();
        if (next.done) {
          return next;
        }
        const value = new _LocationPathEvaluation(this, /* @__PURE__ */ new Set([next.value]), {
          contextPosition,
          contextSize
        });
        contextPosition += 1;
        return {
          done: false,
          value
        };
      }
    };
  }
  values() {
    return this.nodeEvaluations;
  }
  contextPosition() {
    return this.initializedContextPosition;
  }
  contextSize() {
    return this.computedContextSize;
  }
  currentContext() {
    return _LocationPathEvaluation.fromCurrentContext(this);
  }
  rootContext() {
    return _LocationPathEvaluation.fromRoot(this);
  }
  _first;
  first() {
    let result = this._first;
    if (typeof result !== "undefined") {
      return result;
    }
    [result = null] = this.nodeEvaluations;
    this._first = result;
    return result;
  }
  _isEmpty = null;
  isEmpty() {
    let result = this._isEmpty;
    if (result != null) {
      return result;
    }
    result = this.first() == null;
    this._isEmpty = result;
    return result;
  }
  some(predicate) {
    for (const evaluation of this.nodeEvaluations) {
      if (predicate(evaluation)) {
        return true;
      }
    }
    return false;
  }
  toBoolean() {
    return !this.isEmpty();
  }
  toNumber() {
    return this.first()?.toNumber() ?? NaN;
  }
  toString() {
    return this.first()?.toString() ?? "";
  }
  compare(comparator, operand) {
    if (operand instanceof _LocationPathEvaluation) {
      return this.some((lhs) => operand.some((rhs) => comparator(lhs, rhs)));
    }
    return this.some((lhs) => comparator(lhs, operand));
  }
  eq(operand) {
    if (operand.type === "BOOLEAN") {
      return this.toBoolean() === operand.toBoolean();
    }
    return this.compare((lhs, rhs) => lhs.eq(rhs), operand);
  }
  ne(operand) {
    if (operand.type === "BOOLEAN") {
      return this.toBoolean() !== operand.toBoolean();
    }
    return this.compare((lhs, rhs) => lhs.ne(rhs), operand);
  }
  lt(operand) {
    return this.compare((lhs, rhs) => lhs.lt(rhs), operand);
  }
  lte(operand) {
    return this.compare((lhs, rhs) => lhs.lte(rhs), operand);
  }
  gt(operand) {
    return this.compare((lhs, rhs) => lhs.gt(rhs), operand);
  }
  gte(operand) {
    return this.compare((lhs, rhs) => lhs.gte(rhs), operand);
  }
  step(step) {
    const { domProvider, namespaceResolver } = this;
    let nodePredicate;
    switch (step.stepType) {
      case "NodeTypeTest":
      case "UnqualifiedWildcardTest":
        nodePredicate = getNodeTypePredicate(domProvider, step);
        break;
      case "NodeNameTest": {
        const { nodeName } = step;
        const nullNamespaceURI = namespaceResolver.lookupNamespaceURI(null);
        nodePredicate = (node) => {
          if (!domProvider.isQualifiedNamedNode(node)) {
            return false;
          }
          const namespaceURI2 = domProvider.getNamespaceURI(node);
          return domProvider.getLocalName(node) === nodeName && (namespaceURI2 == null || namespaceURI2 === nullNamespaceURI);
        };
        break;
      }
      case "ProcessingInstructionNameTest": {
        const { processingInstructionName } = step;
        nodePredicate = (node) => {
          return domProvider.isProcessingInstruction(node) && domProvider.getProcessingInstructionName(node) === processingInstructionName;
        };
        break;
      }
      case "QualifiedNameTest": {
        const { prefix, localName: localName2 } = step;
        const namespaceURI2 = namespaceResolver.lookupNamespaceURI(prefix);
        nodePredicate = (node) => {
          return domProvider.isQualifiedNamedNode(node) && domProvider.getLocalName(node) === localName2 && domProvider.getNamespaceURI(node) === namespaceURI2;
        };
        break;
      }
      case "QualifiedWildcardTest": {
        const { prefix } = step;
        const namespaceURI2 = namespaceResolver.lookupNamespaceURI(prefix);
        nodePredicate = (node) => {
          return domProvider.isQualifiedNamedNode(node) && domProvider.getNamespaceURI(node) === namespaceURI2;
        };
        break;
      }
      default:
        throw new UnreachableError(step);
    }
    const { axisType } = step;
    const axisEvaluator = axisEvaluators[axisType];
    const context = {
      domProvider: this.domProvider,
      rootNode: this.rootNode,
      contextDocument: this.contextDocument,
      visited: /* @__PURE__ */ new WeakSet()
    };
    const nodes = Array.from(this.contextNodes).flatMap((contextNode) => {
      const currentContext = axisEvaluationContext(context, contextNode);
      const axisNodes = axisEvaluator(currentContext, step);
      return Array.from(axisNodes).filter(nodePredicate);
    });
    if (axisType === "preceding" || axisType === "preceding-sibling") {
      const sorted = nodes.slice().sort(context.domProvider.compareDocumentOrder);
      return new _LocationPathEvaluation(this, new Set(sorted));
    }
    return new _LocationPathEvaluation(this, new Set(nodes));
  }
  evaluateLocationPathExpression(expression) {
    const nodes = expression.evaluateNodes(this);
    return new _LocationPathEvaluation(this, nodes);
  }
};

// src/xpath/vendor/common/constants/xmlns.ts
var XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";
var XML_NAMESPACE_URI = "http://www.w3.org/XML/1998/namespace";
var XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";
var FN_NAMESPACE_URI = "http://www.w3.org/2005/xpath-functions";
var JAVAROSA_NAMESPACE_URI = "http://openrosa.org/javarosa";
var ODK_NAMESPACE_URI = "http://www.opendatakit.org/xforms";
var OPENROSA_XFORMS_NAMESPACE_URI = "http://openrosa.org/xforms";
var XFORMS_NAMESPACE_URI = "http://www.w3.org/2002/xforms";
var ENKETO_NAMESPACE_URI = "http://enketo.org/xforms";
var HTML_PREFIX = "h";
var XML_PREFIX = "xml";
var XMLNS_PREFIX = "xmlns";
var FN_PREFIX = "fn";
var JAVAROSA_PREFIX = "jr";
var ODK_PREFIX = "odk";
var OPENROSA_XFORMS_PREFIX = "orx";
var XFORMS_PREFIX = "xf";
var ENKETO_PREFIX = "enk";

// src/xpath/vendor/common/lib/collections/UpsertableMap.ts
var UpsertableMap = class extends Map {
  upsert(key, produce) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = produce(key);
    this.set(key, value);
    return value;
  }
};

// src/xpath/vendor/xpath/evaluator/NamespaceResolver.ts
var StaticNamespaces = class extends Map {
  constructor(defaultPrefix, defaultURI, namespaces) {
    super([...Object.entries(namespaces), [null, defaultURI], [defaultPrefix, defaultURI]]);
    this.defaultPrefix = defaultPrefix;
    this.defaultURI = defaultURI;
  }
  defaultPrefix;
  defaultURI;
};
var staticNamespaces = new StaticNamespaces("xf", XFORMS_NAMESPACE_URI, {
  [ENKETO_PREFIX]: ENKETO_NAMESPACE_URI,
  [FN_PREFIX]: FN_NAMESPACE_URI,
  [HTML_PREFIX]: XHTML_NAMESPACE_URI,
  html: XHTML_NAMESPACE_URI,
  xhtml: XHTML_NAMESPACE_URI,
  [JAVAROSA_PREFIX]: JAVAROSA_NAMESPACE_URI,
  javarosa: JAVAROSA_NAMESPACE_URI,
  [ODK_PREFIX]: ODK_NAMESPACE_URI,
  [OPENROSA_XFORMS_PREFIX]: OPENROSA_XFORMS_NAMESPACE_URI,
  "openrosa-xforms": OPENROSA_XFORMS_NAMESPACE_URI,
  [XFORMS_PREFIX]: XFORMS_NAMESPACE_URI,
  [XML_PREFIX]: XML_NAMESPACE_URI,
  [XMLNS_PREFIX]: XMLNS_NAMESPACE_URI
});
var namespaceURIs = new UpsertableMap();
var NamespaceResolver = class _NamespaceResolver {
  constructor(domProvider, rootNode, referenceNode, contextResolver) {
    this.domProvider = domProvider;
    this.rootNode = rootNode;
    this.referenceNode = referenceNode;
    const contextResolverNode = referenceNode ?? rootNode;
    if (contextResolver == null) {
      this.contextResolver = (prefix) => {
        return domProvider.resolveNamespaceURI(contextResolverNode, prefix);
      };
    } else if (typeof contextResolver === "function") {
      this.contextResolver = contextResolver;
    } else {
      this.contextResolver = (prefix) => contextResolver.lookupNamespaceURI(prefix);
    }
  }
  domProvider;
  rootNode;
  referenceNode;
  static isInstance(rootNode, value) {
    return value instanceof _NamespaceResolver && value.rootNode === rootNode;
  }
  static from(domProvider, rootNode, referenceNode, contextResolver) {
    if (this.isInstance(rootNode, contextResolver)) {
      return contextResolver;
    }
    return new this(
      domProvider,
      rootNode,
      referenceNode ?? null,
      contextResolver
    );
  }
  contextResolver;
  /**
   * Note: while it is likely consistent with the **spec** to resolve a `null`
   * prefix, it's not typical in a browser environment for the resolver to be
   * consulted for an unprefixed name test in an XPath expression.
   *
   * We _may_ elect to deviate from that typical behavior, as it is the much
   * more **obvious** behavior.
   */
  lookupNamespaceURI(prefix) {
    return namespaceURIs.upsert(this.contextResolver, () => new UpsertableMap()).upsert(prefix, () => {
      return this.contextResolver(prefix) ?? staticNamespaces.get(prefix) ?? null;
    });
  }
};

// src/xpath/vendor/xpath/context/EvaluationContext.ts
var EvaluationContext = class {
  constructor(evaluator, contextNode, options = {}) {
    this.evaluator = evaluator;
    const { domProvider } = evaluator;
    this.domProvider = domProvider;
    const { namespaceResolver } = options;
    const rootNode = options.rootNode ?? domProvider.getContainingDocument(contextNode);
    const contextDocument = domProvider.getContainingDocument(rootNode);
    this.contextDocument = contextDocument;
    this.evaluationContextNode = contextNode;
    this.contextNodes = /* @__PURE__ */ new Set([contextNode]);
    this.rootNode = rootNode;
    this.functions = options.functions ?? evaluator.functions;
    this.namespaceResolver = NamespaceResolver.from(
      domProvider,
      contextDocument,
      contextDocument,
      namespaceResolver
    );
    this.timeZone = options.timeZone ?? evaluator.timeZone;
  }
  evaluator;
  domProvider;
  /**
   * @see {@link Context.evaluationContextNode}
   */
  evaluationContextNode;
  contextDocument;
  rootNode;
  contextNodes;
  functions;
  namespaceResolver;
  timeZone;
  contextPosition() {
    return 1;
  }
  contextSize() {
    return 1;
  }
  currentContext() {
    return LocationPathEvaluation.fromCurrentContext(this);
  }
  rootContext() {
    return LocationPathEvaluation.fromRoot(this);
  }
};

// src/xpath/vendor/xpath/evaluator/functions/FunctionImplementation.ts
var UnknownFunctionError = class extends Error {
  constructor(functionName) {
    super(`Unknown function ${functionName}`);
  }
};
var InvalidArgumentError = class extends Error {
  constructor(argumentIndex, parameter) {
    if (parameter == null) {
      super(`Argument ${argumentIndex} not allowed`);
    } else {
      const { typeHint } = parameter;
      const causeMessage = typeHint == null ? `Expected argument at index ${argumentIndex}` : `Expected argument compatible with type ${typeHint} at index ${argumentIndex}`;
      super(`Invalid argument at index: ${argumentIndex}`, {
        cause: new Error(causeMessage)
      });
    }
  }
};
var FunctionImplementation = class _FunctionImplementation {
  constructor(localName2, signature, runtimeImplementation) {
    this.localName = localName2;
    this.signature = signature;
    const arity = [...signature].reduce(
      (acc, parameter) => {
        const { arityType } = parameter;
        switch (arityType) {
          case "required":
            return {
              min: acc.min + 1,
              max: acc.max + 1
            };
          case "optional":
            return {
              min: acc.min,
              max: acc.max + 1
            };
          case "variadic":
            return {
              min: acc.min,
              max: Infinity
            };
          default:
            throw new UnreachableError(arityType);
        }
      },
      {
        min: 0,
        max: 0
      }
    );
    this.arity = arity;
    this.callable = runtimeImplementation instanceof _FunctionImplementation ? runtimeImplementation.callable : runtimeImplementation;
  }
  localName;
  signature;
  arity;
  callable;
  call(context, args) {
    this.validateArguments(args);
    return this.callable(context, args);
  }
  validateArguments(args) {
    const { arity, signature } = this;
    const { min: min2, max: max2 } = arity;
    const { length: argumentCount } = args;
    if (argumentCount < min2) {
      throw new InvalidArgumentError(min2, null);
    }
    if (argumentCount > max2) {
      throw new InvalidArgumentError(max2, null);
    }
    for (const [index, parameter] of signature.entries()) {
      if (parameter.arityType !== "required") {
        break;
      }
      if (args[index] == null) {
        throw new InvalidArgumentError(index, parameter);
      }
    }
  }
};

// src/xpath/vendor/xpath/evaluator/functions/FunctionLibrary.ts
var FunctionLibrary = class {
  constructor(namespaceURI2, entries) {
    this.namespaceURI = namespaceURI2;
    const implementations = /* @__PURE__ */ new Map();
    entries.forEach((implementation) => {
      const { localName: localName2 } = implementation;
      const qualifiedName = {
        namespaceURI: namespaceURI2,
        localName: localName2
      };
      implementations.set(
        localName2,
        Object.assign(implementation, {
          qualifiedName
        })
      );
    });
    this.implementations = implementations;
  }
  namespaceURI;
  implementations;
  has(localName2) {
    return this.implementations.has(localName2);
  }
  call(localName2, context, args) {
    const implementation = this.implementations.get(localName2);
    if (implementation == null) {
      throw new UnknownFunctionError(localName2);
    }
    return implementation.call(context, args);
  }
  getImplementation(localName2) {
    const implementation = this.implementations.get(localName2);
    return implementation ?? null;
  }
};

// src/xpath/vendor/xpath/functions/fn/boolean.ts
var boolean_exports = {};
__export(boolean_exports, {
  boolean: () => boolean,
  false: () => falseFn,
  lang: () => lang,
  not: () => not,
  true: () => trueFn
});

// src/xpath/vendor/xpath/evaluations/BooleanEvaluation.ts
var BooleanEvaluation = class extends ValueEvaluation {
  constructor(context, value) {
    super();
    this.context = context;
    this.value = value;
    this.booleanValue = value;
    this.numberValue = value ? 1 : 0;
    this.stringValue = String(value);
  }
  context;
  value;
  type = "BOOLEAN";
  nodes = null;
  booleanValue;
  numberValue;
  stringValue;
};

// src/xpath/vendor/xpath/evaluator/functions/TypedFunctionImplementation.ts
var TypedFunctionImplementation = class extends FunctionImplementation {
  constructor(localName2, signature, call, resultFactory) {
    super(localName2, signature, (context, args) => {
      const result = call(context, args);
      return resultFactory(context, result);
    });
  }
};

// src/xpath/vendor/xpath/evaluator/functions/BooleanFunction.ts
var BooleanFunction = class extends TypedFunctionImplementation {
  constructor(localName2, signature, call) {
    super(localName2, signature, call, (context, value) => {
      return new BooleanEvaluation(context, value);
    });
  }
};

// src/xpath/vendor/xpath/functions/fn/boolean.ts
var falseFn = new BooleanFunction("false", [], () => false);
var trueFn = new BooleanFunction("true", [], () => true);
var boolean = new BooleanFunction(
  "boolean",
  [{ arityType: "required" }],
  (context, [expression]) => {
    return expression.evaluate(context).toBoolean();
  }
);
var lang = new BooleanFunction(
  "lang",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const language = expression.evaluate(context).toString().toLowerCase();
    if (language === "") {
      return false;
    }
    const [contextNode] = context.contextNodes;
    if (contextNode == null) {
      return false;
    }
    const { domProvider } = context;
    let currentContextNode = domProvider.isElement(contextNode) ? contextNode : domProvider.getParentNode(contextNode);
    if (currentContextNode == null) {
      return false;
    }
    let langValue = null;
    do {
      if (currentContextNode == null || !domProvider.isElement(currentContextNode)) {
        break;
      }
      langValue = domProvider.getQualifiedNamedAttributeValue(currentContextNode, XML_NAMESPACE_URI, "lang")?.toLowerCase() ?? null;
      currentContextNode = domProvider.getParentNode(currentContextNode);
    } while (langValue == null && currentContextNode != null);
    return langValue != null && (langValue === language || langValue.startsWith(`${language}-`));
  }
);
var not = new BooleanFunction(
  "not",
  [{ arityType: "required" }],
  (context, [expression]) => {
    return !expression.evaluate(context).toBoolean();
  }
);

// src/xpath/vendor/xpath/functions/fn/node-set.ts
var node_set_exports = {};
__export(node_set_exports, {
  count: () => count,
  current: () => current,
  id: () => id,
  last: () => last,
  localName: () => localName,
  name: () => name,
  namespaceURI: () => namespaceURI,
  position: () => position
});

// src/xpath/vendor/xpath/evaluator/functions/NodeSetFunction.ts
var NodeSetFunction = class extends FunctionImplementation {
  constructor(localName2, signature, call) {
    super(localName2, signature, (context, args) => {
      const nodes = call(context, args);
      return LocationPathEvaluation.fromArbitraryNodes(context, nodes, this);
    });
  }
};

// src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts
var NumberEvaluation = class extends ValueEvaluation {
  constructor(context, value) {
    super();
    this.context = context;
    this.value = value;
    this.booleanValue = value !== 0 && !Number.isNaN(value);
    this.numberValue = value;
    this.stringValue = Number.isNaN(value) ? "NaN" : String(value);
  }
  context;
  value;
  type = "NUMBER";
  nodes = null;
  booleanValue;
  numberValue;
  stringValue;
};

// src/xpath/vendor/xpath/evaluator/functions/NumberFunction.ts
var NumberFunction = class extends TypedFunctionImplementation {
  constructor(localName2, signature, call) {
    super(localName2, signature, call, (context, value) => {
      return new NumberEvaluation(context, value);
    });
  }
};

// src/xpath/vendor/xpath/evaluator/functions/StringFunction.ts
var StringFunction = class extends TypedFunctionImplementation {
  constructor(localName2, signature, call) {
    super(localName2, signature, call, (context, value) => {
      return new StringEvaluation(context, value);
    });
  }
};

// src/xpath/vendor/xpath/functions/fn/node-set.ts
var count = new NumberFunction(
  "count",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const results = expression.evaluate(context);
    if (results.nodes == null) {
      throw new Error("Expected a node-set for count function, but received null.");
    }
    return new Set(results.nodes).size;
  }
);
var current = new NodeSetFunction("current", [], (context) => {
  return [context.evaluationContextNode];
});
var id = new NodeSetFunction(
  "id",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const idArgument = expression.evaluate(context);
    const idArguments = idArgument.type === "NODE" ? Array.from(idArgument) : [idArgument.first()];
    const elementIds = Array.from(
      new Set(
        idArguments.flatMap(
          (argument) => normalizeXMLXPathWhitespace(argument?.toString() ?? "").split(" ")
        )
      )
    );
    if (elementIds.length === 0) {
      return [];
    }
    const { contextDocument, domProvider } = context;
    const elements = elementIds.flatMap((elementId) => {
      const element = domProvider.getElementByUniqueId(contextDocument, elementId);
      if (element == null) {
        return [];
      }
      return element;
    });
    return elements.slice().sort(context.domProvider.compareDocumentOrder);
  }
);
var last = new NumberFunction("last", [], (context) => context.contextSize());
var localName = new StringFunction(
  "local-name",
  [{ arityType: "optional" }],
  (context, [expression]) => {
    const evaluated = expression?.evaluate(context) ?? context;
    if (!(evaluated instanceof LocationPathEvaluation)) {
      throw new Error("Expected a node-set for local-name function, but received an invalid type.");
    }
    const node = evaluated.first()?.value;
    if (node == null) {
      return "";
    }
    const { domProvider } = context;
    if (domProvider.isQualifiedNamedNode(node)) {
      return domProvider.getLocalName(node);
    }
    if (domProvider.isProcessingInstruction(node)) {
      return domProvider.getProcessingInstructionName(node);
    }
    return "";
  }
);
var name = new StringFunction(
  "name",
  [{ arityType: "optional" }],
  (context, [expression]) => {
    const evaluated = expression?.evaluate(context) ?? context;
    if (!(evaluated instanceof LocationPathEvaluation)) {
      throw new Error("Expected a node-set for name function, but received an invalid type.");
    }
    const node = evaluated.first()?.value;
    if (node == null) {
      return "";
    }
    const { domProvider } = context;
    if (domProvider.isQualifiedNamedNode(node)) {
      return domProvider.getQualifiedName(node);
    }
    if (domProvider.isProcessingInstruction(node)) {
      return domProvider.getProcessingInstructionName(node);
    }
    return "";
  }
);
var namespaceURI = new StringFunction(
  "namespace-uri",
  [{ arityType: "optional" }],
  (context, [expression]) => {
    const evaluated = expression?.evaluate(context) ?? context;
    if (!(evaluated instanceof LocationPathEvaluation)) {
      throw new Error(
        "Expected a node-set for namespace-uri function, but received an invalid type."
      );
    }
    const node = evaluated.first()?.value;
    if (node == null) {
      return "";
    }
    const { domProvider } = context;
    if (domProvider.isQualifiedNamedNode(node)) {
      return domProvider.getNamespaceURI(node) ?? "";
    }
    return "";
  }
);
var position = new NumberFunction(
  "position",
  [],
  (context) => context.contextPosition()
);

// src/xpath/vendor/xpath/functions/fn/number.ts
var number_exports = {};
__export(number_exports, {
  ceiling: () => ceiling,
  floor: () => floor,
  number: () => number,
  round: () => round,
  sum: () => sum
});

// src/xpath/vendor/xpath/evaluator/functions/FunctionAlias.ts
var FunctionAlias = class extends FunctionImplementation {
  constructor(localName2, baseImplementation) {
    super(localName2, baseImplementation.signature, baseImplementation);
  }
};

// src/xpath/vendor/xpath/functions/_shared/number.ts
var evaluateInt = (context, expression) => parseInt(expression.evaluate(context).toString(), 10);
var mathAlias = (method) => new NumberFunction(method, [{ arityType: "required" }], (context, [expression]) => {
  const number3 = (expression?.evaluate(context) ?? context).toNumber();
  if (Number.isNaN(number3)) {
    return number3;
  }
  return Math[method](number3);
});
var math2Alias = (method) => new NumberFunction(
  method,
  [{ arityType: "required" }, { arityType: "required" }],
  (context, [expression0, expression1]) => {
    const number0 = expression0.evaluate(context).toNumber();
    if (Number.isNaN(number0)) {
      return number0;
    }
    const number1 = expression1.evaluate(context).toNumber();
    if (Number.isNaN(number1)) {
      return number1;
    }
    return Math[method](number0, number1);
  }
);
var toNumberArguments = (context, expressions, options) => {
  const numbers = [];
  for (const expression of expressions) {
    const results = expression.evaluate(context);
    for (const result of results) {
      const number3 = result.toNumber();
      numbers.push(number3);
      if (Number.isNaN(number3) && options.shortCircuitOnNaN) {
        return numbers;
      }
    }
  }
  return numbers;
};
var mathNAlias = (method) => new NumberFunction(
  method,
  [
    // Deviates from ODK XForms spec, matches ORXE
    { arityType: "variadic" }
  ],
  (context, expressions) => {
    const args = toNumberArguments(context, expressions, {
      shortCircuitOnNaN: true
    });
    if (args.length === 0) {
      return NaN;
    }
    return Math[method](...args);
  }
);

// src/xpath/vendor/xpath/functions/fn/number.ts
var ceil = mathAlias("ceil");
var ceiling = new FunctionAlias("ceiling", ceil);
var floor = mathAlias("floor");
var number = new NumberFunction(
  "number",
  [{ arityType: "optional" }],
  (context, [expression]) => (expression?.evaluate(context) ?? context).toNumber()
);
var round = mathAlias("round");
var sum = new NumberFunction(
  "sum",
  [{ arityType: "required" }],
  (context, expressions) => {
    if (expressions.length === 0) {
      return NaN;
    }
    let result;
    for (const expression of expressions) {
      const resultSet = expression.evaluate(context);
      for (const item of resultSet) {
        const numberValue = item.toNumber();
        if (Number.isNaN(numberValue)) {
          result = NaN;
          break;
        }
        result = result == null ? numberValue : result + numberValue;
        if (Number.isNaN(result)) {
          break;
        }
      }
    }
    return result ?? NaN;
  }
);

// src/xpath/vendor/xpath/functions/fn/string.ts
var string_exports = {};
__export(string_exports, {
  concat: () => concat,
  contains: () => contains,
  normalizeSpace: () => normalizeSpace,
  startsWith: () => startsWith,
  string: () => string,
  stringLength: () => stringLength,
  substring: () => substring,
  substringAfter: () => substringAfter,
  substringBefore: () => substringBefore,
  translate: () => translate
});

// src/xpath/vendor/xpath/lib/regex/escape.ts
var escapeRegExp = (value) => value.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");

// src/xpath/vendor/xpath/functions/fn/string.ts
var concat = new StringFunction(
  "concat",
  [{ arityType: "variadic", typeHint: "string" }],
  (context, expressions) => {
    if (expressions.length === 0) {
      return "";
    }
    return expressions.reduce(
      (acc, expression) => `${acc}${expression.evaluate(context).toString()}`,
      ""
    );
  }
);
var contains = new BooleanFunction(
  "contains",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [haystackExpression, needleExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    return haystack.includes(needleExpression.evaluate(context).toString());
  }
);
var normalizeSpace = new StringFunction(
  "normalize-space",
  [{ arityType: "optional", typeHint: "string" }],
  (context, [expression]) => {
    const value = (expression?.evaluate(context) ?? context).toString();
    return normalizeXMLXPathWhitespace(value);
  }
);
var startsWith = new BooleanFunction(
  "starts-with",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [haystackExpression, needleExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    const needle = needleExpression.evaluate(context).toString();
    return haystack.startsWith(needle);
  }
);
var stringLength = new NumberFunction(
  "string-length",
  [{ arityType: "optional", typeHint: "string" }],
  (context, [expression]) => {
    return (expression?.evaluate(context) ?? context).toString().length;
  }
);
var substringAfter = new StringFunction(
  "substring-after",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [haystackExpression, needleExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    if (haystack === "") {
      return "";
    }
    const needle = needleExpression.evaluate(context).toString();
    if (needle === "") {
      return haystack;
    }
    const needleIndex = haystack.indexOf(needle);
    return needleIndex === -1 ? "" : haystack.slice(needleIndex + 1);
  }
);
var substringBefore = new StringFunction(
  "substring-before",
  [{ arityType: "required" }, { arityType: "required", typeHint: "string" }],
  (context, [haystackExpression, needleExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    if (haystack === "") {
      return "";
    }
    const needle = needleExpression.evaluate(context).toString();
    const needleIndex = haystack.indexOf(needle);
    return needleIndex === -1 ? "" : haystack.slice(0, needleIndex);
  }
);
var substring = new StringFunction(
  "substring",
  [
    { arityType: "required" },
    { arityType: "required", typeHint: "number" },
    { arityType: "optional", typeHint: "number" }
  ],
  (context, [stringExpression, startExpression, lengthExpression]) => {
    const string2 = stringExpression.evaluate(context).toString();
    if (string2 === "") {
      return string2;
    }
    const start = Math.round(startExpression.evaluate(context).toNumber()) - 1;
    if (start === Number.POSITIVE_INFINITY || Number.isNaN(start)) {
      return "";
    }
    const length = lengthExpression?.evaluate(context).toNumber();
    if (length != null && Number.isNaN(length)) {
      return "";
    }
    const end = length == null ? string2.length : start + Math.round(length);
    return string2.substring(start, end);
  }
);
var string = new StringFunction(
  "string",
  [{ arityType: "optional" }],
  (context, [expression]) => (expression?.evaluate(context) ?? context).toString()
);
var translate = new StringFunction(
  "translate",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [haystackExpression, needlesExpression, replacementsExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    const needles = needlesExpression.evaluate(context).toString().split("");
    const replacements = replacementsExpression.evaluate(context).toString().split("");
    const replacementMap = needles.reduce((acc, needle, index) => {
      if (acc.has(needle)) {
        return acc;
      }
      const replacement = replacements[index] ?? "";
      acc.set(needle, replacement);
      return acc;
    }, /* @__PURE__ */ new Map());
    const needleSubPatterns = needles.map((needle) => escapeRegExp(needle));
    const pattern = new RegExp(`(${needleSubPatterns.join("|")})`, "g");
    return haystack.replaceAll(pattern, (match) => {
      const replacement = replacementMap.get(match) ?? "";
      return replacement;
    });
  }
);

// src/xpath/vendor/xpath/functions/fn/index.ts
var fn = new FunctionLibrary(FN_NAMESPACE_URI, [
  ...Object.values(boolean_exports),
  ...Object.values(node_set_exports),
  ...Object.values(number_exports),
  ...Object.values(string_exports)
]);

// src/xpath/vendor/xpath/evaluator/step/Step.ts
var BaseStep = class {
  constructor(axisType) {
    this.axisType = axisType;
  }
  axisType;
};
var RootContextStep = class extends BaseStep {
  axisType = "__ROOT__";
  stepType = "NodeTypeTest";
  nodeType = "node";
  localName = void 0;
  prefix = void 0;
  nodeName = void 0;
  processingInstructionName = void 0;
  predicates = [];
  constructor() {
    super("__ROOT__");
  }
};
var EvaluationContextNodeStep = class extends BaseStep {
  stepType = "NodeTypeTest";
  axisType = "self";
  nodeType = "node";
  localName = void 0;
  prefix = void 0;
  nodeName = void 0;
  processingInstructionName = void 0;
  predicates = [];
  constructor() {
    super("self");
  }
};
var FilterExprContextNodeStep = class extends BaseStep {
  stepType = "NodeTypeTest";
  axisType = "self";
  nodeType = "node";
  localName = void 0;
  prefix = void 0;
  nodeName = void 0;
  processingInstructionName = void 0;
  predicates = [];
  constructor() {
    super("self");
  }
};
var NodeTypeTestStep = class extends BaseStep {
  constructor(axisType, nodeType, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.nodeType = nodeType;
    this.predicates = predicates;
  }
  axisType;
  nodeType;
  predicates;
  stepType = "NodeTypeTest";
  localName = void 0;
  prefix = void 0;
  nodeName = void 0;
  processingInstructionName = void 0;
};
var BaseNameTestStep = class extends BaseStep {
  nodeType = "__NAMED__";
};
var ProcessingInstructionNameTestStep = class extends BaseStep {
  constructor(axisType, processingInstructionName, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.processingInstructionName = processingInstructionName;
    this.predicates = predicates;
  }
  axisType;
  processingInstructionName;
  predicates;
  stepType = "ProcessingInstructionNameTest";
  localName = void 0;
  prefix = void 0;
  nodeName = void 0;
  nodeType = "processing-instruction";
};
var QualifiedNameTestStep = class extends BaseNameTestStep {
  constructor(axisType, prefix, localName2, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.prefix = prefix;
    this.localName = localName2;
    this.predicates = predicates;
  }
  axisType;
  prefix;
  localName;
  predicates;
  stepType = "QualifiedNameTest";
  nodeName = void 0;
  processingInstructionName = void 0;
};
var NodeNameTestStep = class extends BaseNameTestStep {
  constructor(axisType, nodeName, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.nodeName = nodeName;
    this.predicates = predicates;
  }
  axisType;
  nodeName;
  predicates;
  stepType = "NodeNameTest";
  localName = void 0;
  prefix = void 0;
  processingInstructionName = void 0;
};
var QualifiedWildcardTestStep = class extends BaseNameTestStep {
  constructor(axisType, prefix, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.prefix = prefix;
    this.predicates = predicates;
  }
  axisType;
  prefix;
  predicates;
  stepType = "QualifiedWildcardTest";
  localName = null;
  nodeName = void 0;
  processingInstructionName = void 0;
};
var UnqualifiedWildcardTestStep = class extends BaseNameTestStep {
  constructor(axisType, predicates) {
    super(axisType);
    this.axisType = axisType;
    this.predicates = predicates;
  }
  axisType;
  predicates;
  stepType = "UnqualifiedWildcardTest";
  localName = null;
  prefix = null;
  nodeName = void 0;
  processingInstructionName = void 0;
};
var axisTestStep = (axisType, axisTestNode, predicateNodes) => {
  const { text } = axisTestNode;
  switch (axisTestNode.type) {
    case "node_type_test": {
      let nodeType;
      if (text.startsWith("comment")) {
        nodeType = "comment";
      } else if (text.startsWith("node")) {
        nodeType = "node";
      } else if (text.startsWith("processing-instruction")) {
        nodeType = "processing-instruction";
      } else {
        nodeType = "text";
      }
      return new NodeTypeTestStep(axisType, nodeType, predicateNodes);
    }
    case "prefixed_name": {
      const [prefixNode, localPartNode] = axisTestNode.children;
      return new QualifiedNameTestStep(
        axisType,
        prefixNode.text,
        localPartNode.text,
        predicateNodes
      );
    }
    case "prefixed_wildcard_name_test": {
      const [prefixNode] = axisTestNode.children;
      return new QualifiedWildcardTestStep(axisType, prefixNode.text, predicateNodes);
    }
    case "unprefixed_name": {
      return new NodeNameTestStep(axisType, axisTestNode.text, predicateNodes);
    }
    case "unprefixed_wildcard_name_test":
      return new UnqualifiedWildcardTestStep(axisType, predicateNodes);
    case "processing_instruction_name_test": {
      const [nameNode] = axisTestNode.children;
      const { text: nameText } = nameNode;
      const procssingInstructionName = nameText.substring(1, nameText.length - 1);
      return new ProcessingInstructionNameTestStep(
        axisType,
        procssingInstructionName,
        predicateNodes
      );
    }
    default:
      throw new UnreachableError(axisTestNode);
  }
};
var pathExprStep = (stepNode) => {
  const [syntaxNode, ...predicateNodes] = stepNode.children;
  switch (syntaxNode.type) {
    case "abbreviated_axis_test": {
      const [axisTestNode] = syntaxNode.children;
      return axisTestStep("attribute", axisTestNode, predicateNodes);
    }
    case "abbreviated_step": {
      let axisType;
      switch (syntaxNode.text) {
        case ".":
          axisType = "self";
          break;
        case "..":
          axisType = "parent";
          break;
        default:
          throw new UnreachableError(syntaxNode);
      }
      return new NodeTypeTestStep(axisType, "node", predicateNodes);
    }
    case "axis_test": {
      const [axisNameNode, axisTestNode] = syntaxNode.children;
      return axisTestStep(axisNameNode.text, axisTestNode, predicateNodes);
    }
    case "node_test": {
      const [axisTestNode] = syntaxNode.children;
      return axisTestStep("child", axisTestNode, predicateNodes);
    }
    default:
      throw new UnreachableError(syntaxNode);
  }
};
var pathExprContextStep = (syntaxNode) => {
  switch (syntaxNode.type) {
    case "abbreviated_absolute_location_path":
    case "absolute_root_location_path":
      return new RootContextStep();
    case "filter_expr":
    // A nested FilterPathExpr (e.g. instance('id')/a/b[p]) as the left-hand
    // operand of an outer FilterPathExpr (e.g. .../c[q]). The inner expression
    // is already evaluated by FilterPathExpressionEvaluator and its result is
    // passed as the evaluation context, so a self-axis context step is correct.
    case "filter_path_expr":
      return new FilterExprContextNodeStep();
    case "step":
      return new EvaluationContextNodeStep();
    default:
      throw new UnreachableError(syntaxNode);
  }
};
var pathExprSteps = (syntaxNode) => {
  const { children } = syntaxNode;
  const [contextChildNode, ...rest] = children;
  const stepNodes = contextChildNode.type === "abbreviated_absolute_location_path" ? contextChildNode.children : contextChildNode.type === "step" ? [contextChildNode, ...rest] : rest;
  const contextStep = pathExprContextStep(contextChildNode);
  const steps = [];
  for (const stepNode of stepNodes) {
    switch (stepNode.type) {
      case "//":
        steps.push(new NodeTypeTestStep("descendant-or-self", "node", []));
        break;
      case "step":
        steps.push(pathExprStep(stepNode));
        break;
      default:
        throw new UnreachableError(stepNode);
    }
  }
  return [contextStep, ...steps];
};

// src/xpath/vendor/xpath/evaluator/expression/LocationPathExpressionEvaluator.ts
var LocationPathExpressionEvaluator = class {
  evaluate(context) {
    const locationPathContext = context.currentContext();
    return locationPathContext.evaluateLocationPathExpression(this);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/NumberExpressionEvaluator.ts
var NumberExpressionEvaluator = class {
  constructor(constValue) {
    this.constValue = constValue;
  }
  constValue;
  evaluate(context) {
    const numberValue = this.evaluateNumber(context);
    return new NumberEvaluation(context.currentContext(), numberValue);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/LocationPathEvaluator.ts
var LocationPathEvaluator = class extends LocationPathExpressionEvaluator {
  constructor(syntaxNode, options) {
    super();
    this.syntaxNode = syntaxNode;
    this.isAbsolute = options.isAbsolute;
    this.isFilterExprContext = options.isFilterExprContext;
    this.isRoot = options.isRoot;
    this.isSelf = options.isSelf;
    this.steps = pathExprSteps(syntaxNode);
  }
  syntaxNode;
  isAbsolute;
  isFilterExprContext;
  isRoot;
  isSelf;
  steps;
  evaluateNodes(context) {
    if (this.isRoot) {
      return context.rootContext().nodes;
    }
    if (this.isSelf) {
      return context.contextNodes;
    }
    const [contextStep, ...rest] = this.steps;
    let currentContext;
    switch (contextStep.axisType) {
      case "__ROOT__":
        currentContext = context.rootContext();
        break;
      case "self":
        currentContext = context.currentContext();
        break;
      default:
        throw new UnreachableError(contextStep);
    }
    for (const step of rest) {
      currentContext = currentContext.step(step);
      for (const predicateNode of step.predicates) {
        const [predicateExpressionNode] = predicateNode.children;
        const predicateExpression = createExpression(predicateExpressionNode);
        let positionPredicate = null;
        if (predicateExpression instanceof NumberExpressionEvaluator) {
          positionPredicate = predicateExpression.evaluate(currentContext).toNumber();
        }
        const filteredNodes = [];
        for (const self of currentContext) {
          if (positionPredicate != null) {
            if (self.contextPosition() === positionPredicate) {
              filteredNodes.push(...self.contextNodes);
              break;
            } else {
              continue;
            }
          }
          const predicateResult = predicateExpression.evaluate(self);
          if (predicateResult.type === "NUMBER") {
            const evaluatedPositionPredicate = predicateResult.toNumber();
            if (self.contextPosition() === evaluatedPositionPredicate) {
              filteredNodes.push(...self.contextNodes);
            }
          } else if (predicateResult.toBoolean()) {
            filteredNodes.push(...self.contextNodes);
          }
        }
        currentContext = LocationPathEvaluation.fromArbitraryNodes(
          currentContext,
          filteredNodes,
          this
        );
      }
    }
    return currentContext.contextNodes;
  }
};

// src/xpath/vendor/xpath/evaluator/expression/AbsoluteLocationPathExpressionEvaluator.ts
var AbsoluteLocationPathExpressionEvaluator = class extends LocationPathEvaluator {
  constructor(syntaxNode) {
    const { text } = syntaxNode;
    const isRoot = text === "/";
    super(syntaxNode, {
      isAbsolute: true,
      isFilterExprContext: false,
      isRoot,
      isSelf: false
    });
    this.syntaxNode = syntaxNode;
  }
  syntaxNode;
};

// src/xpath/vendor/xpath/evaluator/expression/BinaryExpressionEvaluator.ts
var BinaryExpressionEvaluator = class {
  constructor(syntaxNode) {
    this.syntaxNode = syntaxNode;
    const [lhsNode, rhsNode] = syntaxNode.children;
    this.lhs = createExpression(lhsNode);
    this.rhs = createExpression(rhsNode);
  }
  syntaxNode;
  lhs;
  rhs;
};

// src/xpath/vendor/xpath/evaluator/expression/BooleanBinaryExpressionEvaluator.ts
var BooleanBinaryExpressionEvaluator = class extends BinaryExpressionEvaluator {
  operator;
  constructor(syntaxNode) {
    super(syntaxNode);
    this.operator = syntaxNode.type.replace("_expr", "");
  }
  and(context) {
    const { lhs, rhs } = this;
    const lhsResult = lhs.evaluate(context);
    if (!lhsResult.toBoolean()) {
      return new BooleanEvaluation(context.currentContext(), false);
    }
    const rhsResult = rhs.evaluate(context);
    return new BooleanEvaluation(context.currentContext(), rhsResult.toBoolean());
  }
  or(context) {
    const { lhs, rhs } = this;
    const lhsResult = lhs.evaluate(context);
    if (lhsResult.toBoolean()) {
      return new BooleanEvaluation(context.currentContext(), true);
    }
    const rhsResult = rhs.evaluate(context);
    return new BooleanEvaluation(context.currentContext(), rhsResult.toBoolean());
  }
  compare(context, operator) {
    const { lhs, rhs } = this;
    const lhsResult = lhs.evaluate(context);
    const rhsResult = rhs.evaluate(context);
    return new BooleanEvaluation(context.currentContext(), lhsResult[operator](rhsResult));
  }
  evaluate(context) {
    const { operator } = this;
    switch (operator) {
      case "and":
        return this.and(context);
      case "or":
        return this.or(context);
      default:
        return this.compare(context, operator);
    }
  }
};

// src/xpath/vendor/xpath/evaluator/expression/FilterPathExpressionEvaluator.ts
var FilterPathExpressionEvaluator = class extends LocationPathEvaluator {
  constructor(syntaxNode) {
    const [filterExprNode, ...rest] = syntaxNode.children;
    super(syntaxNode, {
      isAbsolute: false,
      isFilterExprContext: true,
      isRoot: false,
      isSelf: false
    });
    this.syntaxNode = syntaxNode;
    this.hasSteps = rest.length > 0;
    const firstChildNode = filterExprNode;
    if (firstChildNode.type === "filter_path_expr") {
      this.filterExpression = createExpression(firstChildNode);
    } else {
      const [exprNode] = firstChildNode.children;
      this.filterExpression = createExpression(exprNode);
    }
  }
  syntaxNode;
  filterExpression;
  hasSteps;
  evaluateNodes(context) {
    if (this.hasSteps) {
      const filterContextResults = this.filterExpression.evaluate(context);
      LocationPathEvaluation.assertInstance(context, filterContextResults);
      return super.evaluateNodes(filterContextResults);
    }
    return this.filterExpression.evaluateNodes(context);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/FunctionCallExpressionEvaluator.ts
var functionCallName = (syntaxNode) => {
  const [nameNode] = syntaxNode.children[0].children;
  switch (nameNode.type) {
    case "prefixed_name": {
      const [prefixNode, localNameNode] = nameNode.children;
      return {
        prefix: prefixNode.text,
        localName: localNameNode.text
      };
    }
    case "unprefixed_name":
      return {
        prefix: null,
        localName: nameNode.text
      };
    default:
      throw new UnreachableError(nameNode);
  }
};
var FunctionCallExpressionEvaluator = class {
  constructor(syntaxNode) {
    this.syntaxNode = syntaxNode;
    const [, ...argumentNodes] = syntaxNode.children;
    this.name = functionCallName(syntaxNode);
    this.argumentExpressions = argumentNodes.map((argumentNode) => {
      return createExpression(argumentNode);
    });
  }
  syntaxNode;
  name;
  argumentExpressions;
  evaluate(context) {
    const { argumentExpressions, name: name2 } = this;
    const { functions: functions2 } = context;
    const functionImplementation = functions2.getImplementation(context, name2);
    if (functionImplementation == null) {
      const { prefix, localName: localName2 } = name2;
      const errorName = prefix == null ? localName2 : `${prefix}:${localName2}`;
      throw new Error(`Function '${errorName}' is not defined.`);
    }
    return functionImplementation.call(context.currentContext(), argumentExpressions);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/NumberLiteralExpressionEvaluator.ts
var NumberLiteralExpressionEvaluator = class extends NumberExpressionEvaluator {
  constructor(syntaxNode) {
    const { text } = syntaxNode;
    const constValue = Number(text);
    super(constValue);
    this.syntaxNode = syntaxNode;
  }
  syntaxNode;
  evaluateNumber() {
    return this.constValue;
  }
};

// src/xpath/vendor/xpath/evaluator/expression/NumericBinaryExpressionEvaluator.ts
var NumericBinaryExpressionEvaluator = class extends BinaryExpressionEvaluator {
  operation;
  constructor(node) {
    super(node);
    this.operation = node.type.replace("_expr", "");
  }
  evaluate(context) {
    const lhsNumberValue = this.lhs.evaluate(context).toNumber();
    if (Number.isNaN(lhsNumberValue)) {
      return new NumberEvaluation(context.currentContext(), NaN);
    }
    const rhsNumberValue = this.rhs.evaluate(context).toNumber();
    if (Number.isNaN(rhsNumberValue)) {
      return new NumberEvaluation(context.currentContext(), NaN);
    }
    const { operation } = this;
    let numberValue;
    switch (operation) {
      case "addition":
        numberValue = lhsNumberValue + rhsNumberValue;
        break;
      case "division":
        numberValue = lhsNumberValue / rhsNumberValue;
        break;
      case "modulo":
        numberValue = lhsNumberValue % rhsNumberValue;
        break;
      case "multiplication":
        numberValue = lhsNumberValue * rhsNumberValue;
        break;
      case "subtraction":
        numberValue = lhsNumberValue - rhsNumberValue;
        break;
      default:
        throw new UnreachableError(operation);
    }
    return new NumberEvaluation(context.currentContext(), numberValue);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/RelativeLocationPathExpressionEvaluator.ts
var RelativeLocationPathExpressionEvaluator = class extends LocationPathEvaluator {
  constructor(syntaxNode) {
    const { text } = syntaxNode;
    const isSelf = text === ".";
    super(syntaxNode, {
      isAbsolute: false,
      isFilterExprContext: false,
      isRoot: false,
      isSelf
    });
    this.syntaxNode = syntaxNode;
  }
  syntaxNode;
};

// src/xpath/vendor/xpath/evaluator/expression/StringExpressionEvaluator.ts
var StringExpressionEvaluator = class {
  constructor(constValue) {
    this.constValue = constValue;
  }
  constValue;
  evaluate(context) {
    const stringValue2 = this.evaluateString(context);
    return new StringEvaluation(context.currentContext(), stringValue2);
  }
};

// src/xpath/vendor/xpath/evaluator/expression/StringLiteralExpressionEvaluator.ts
var StringLiteralExpressionEvaluator = class extends StringExpressionEvaluator {
  constructor(syntaxNode) {
    const { text } = syntaxNode;
    const constValue = text.substring(1, text.length - 1);
    super(constValue);
    this.syntaxNode = syntaxNode;
  }
  syntaxNode;
  evaluateString() {
    return this.constValue;
  }
};

// src/xpath/vendor/xpath/evaluator/expression/UnaryExpressionEvaluator.ts
var UnaryExpressionEvaluator = class extends NumberExpressionEvaluator {
  constructor(syntaxNode) {
    super(null);
    this.syntaxNode = syntaxNode;
    this.operand = createExpression(syntaxNode.children[0]);
  }
  syntaxNode;
  operand;
  evaluateNumber(context) {
    return this.operand.evaluate(context).toNumber() * -1;
  }
};

// src/xpath/vendor/xpath/evaluator/expression/UnionExpressionEvaluator.ts
var UnionExpressionEvaluator = class extends LocationPathExpressionEvaluator {
  constructor(syntaxNode) {
    super();
    this.syntaxNode = syntaxNode;
    const [lhsNode, rhsNode] = syntaxNode.children;
    this.lhs = createExpression(lhsNode);
    this.rhs = createExpression(rhsNode);
  }
  syntaxNode;
  lhs;
  rhs;
  evaluateNodes(context) {
    const lhs = this.lhs.evaluate(context);
    if (!(lhs instanceof LocationPathEvaluation)) {
      throw new Error("Left-hand side expression did not evaluate to a node-set.");
    }
    const rhs = this.rhs.evaluate(context);
    if (!(rhs instanceof LocationPathEvaluation)) {
      throw new Error("Right-hand side expression did not evaluate to a node-set.");
    }
    const nodes = Array.from(/* @__PURE__ */ new Set([...lhs.nodes, ...rhs.nodes]));
    return new Set(nodes.slice().sort(context.domProvider.compareDocumentOrder));
  }
};

// src/xpath/vendor/xpath/error/JRCompatibleError.ts
var JRCompatibleError = class extends Error {
};

// src/xpath/vendor/xpath/error/UnboundVariableError.ts
var UnboundVariableError = class extends JRCompatibleError {
  constructor(name2) {
    super(`Undefined XPath variable: $${name2}`);
    this.name = "UnboundVariableError";
  }
};

// src/xpath/evaluator/VariableScope.ts
var activeVariables = null;
function setActiveVariables(map, fn2) {
  const previous = activeVariables;
  activeVariables = map;
  try {
    return fn2();
  } finally {
    activeVariables = previous;
  }
}
function getActiveVariable(name2) {
  return activeVariables?.get(name2);
}

// src/xpath/vendor/xpath/evaluator/expression/VariableReferenceExpressionEvaluator.ts
var VariableReferenceExpressionEvaluator = class {
  constructor(syntaxNode) {
    this.syntaxNode = syntaxNode;
  }
  syntaxNode;
  evaluate(context) {
    const name2 = this.syntaxNode.text.slice(1);
    const value = getActiveVariable(name2);
    if (value === void 0) {
      throw new UnboundVariableError(name2);
    }
    const currentContext = context.currentContext();
    switch (typeof value) {
      case "number":
        return new NumberEvaluation(currentContext, value);
      case "boolean":
        return new BooleanEvaluation(currentContext, value);
      default:
        return new StringEvaluation(currentContext, value);
    }
  }
};

// src/xpath/vendor/xpath/evaluator/expression/factory.ts
var createExpression = (syntaxNode) => {
  switch (syntaxNode.type) {
    case "xpath":
    case "argument": {
      const [evaluableNode] = syntaxNode.children[0].children;
      return createExpression(evaluableNode);
    }
    case "expr":
    // filter_expr is a grammar wrapper node — unwrap to its single child.
    // This handles cases where FilterPathExprNode.filterExprNode.children[0]
    // is itself a filter_expr (nested wrapping in the tree-sitter grammar).
    case "filter_expr": {
      const [evaluableNode] = syntaxNode.children;
      return createExpression(evaluableNode);
    }
    case "and_expr":
    case "eq_expr":
    case "gt_expr":
    case "gte_expr":
    case "lt_expr":
    case "lte_expr":
    case "ne_expr":
    case "or_expr": {
      return new BooleanBinaryExpressionEvaluator(syntaxNode);
    }
    case "addition_expr":
    case "division_expr":
    case "subtraction_expr":
    case "modulo_expr":
    case "multiplication_expr": {
      return new NumericBinaryExpressionEvaluator(syntaxNode);
    }
    case "union_expr": {
      return new UnionExpressionEvaluator(syntaxNode);
    }
    case "unary_expr": {
      return new UnaryExpressionEvaluator(syntaxNode);
    }
    case "function_call": {
      return new FunctionCallExpressionEvaluator(syntaxNode);
    }
    case "absolute_location_path":
      return new AbsoluteLocationPathExpressionEvaluator(syntaxNode);
    case "filter_path_expr":
      if (syntaxNode.children.length === 1) {
        const [exprNode] = syntaxNode.children[0].children;
        return createExpression(exprNode);
      }
      return new FilterPathExpressionEvaluator(syntaxNode);
    case "relative_location_path":
      return new RelativeLocationPathExpressionEvaluator(syntaxNode);
    case "number": {
      return new NumberLiteralExpressionEvaluator(syntaxNode);
    }
    case "string_literal":
      return new StringLiteralExpressionEvaluator(syntaxNode);
    case "variable_reference":
      return new VariableReferenceExpressionEvaluator(syntaxNode);
    default:
      throw new UnreachableError(syntaxNode);
  }
};

// src/xpath/vendor/xpath/evaluator/functions/FunctionLibraryCollection.ts
var UnknownFunctionLibraryError = class extends Error {
  constructor(namespaceURI2) {
    super(`Unknown function library for namespace ${namespaceURI2}`);
  }
};
var FunctionLibraryCollection = class {
  /**
   * Default function libraries determine, for a given Evaluator instance and
   * its corresponding FunctionLibraryCollection instance, which function calls
   * may be resolved without a prefix.
   *
   * Unprefixed functions are looked up by local name in each successive default
   * library until one is matched. For example, when both the `xf` and `fn`
   * libraries are defaults (in that order), `number` will resolve to the `xf`
   * namespace because it provides a function with `localName: number`
   * (overriding the default `fn:number`), whereas `string` will resolve to the
   * `fn` namespace, because the `xf` namespace does not override it.
   */
  defaultFunctionLibraries;
  namespacedFunctionLibraries;
  constructor(functionLibraries, options = {}) {
    const namespacedFunctionLibraries = /* @__PURE__ */ new Map();
    for (const functionLibrary of functionLibraries) {
      const { namespaceURI: namespaceURI2 } = functionLibrary;
      if (namespacedFunctionLibraries.has(namespaceURI2)) {
        throw new Error(`Multiple function libraries for namespace: ${namespaceURI2}`);
      }
      namespacedFunctionLibraries.set(namespaceURI2, functionLibrary);
    }
    this.namespacedFunctionLibraries = namespacedFunctionLibraries;
    const { defaultNamespaceURIs = [FN_NAMESPACE_URI] } = options;
    this.defaultFunctionLibraries = defaultNamespaceURIs.map((namespaceURI2) => {
      const functionLibrary = namespacedFunctionLibraries.get(namespaceURI2);
      if (functionLibrary == null) {
        throw new Error(`No function library for default namespace: ${namespaceURI2}`);
      }
      return functionLibrary;
    });
  }
  getDefaultImplementation(localName2) {
    for (const functionLibrary of this.defaultFunctionLibraries) {
      const functionImplementation = functionLibrary.getImplementation(localName2);
      if (functionImplementation != null) {
        return functionImplementation;
      }
    }
    return null;
  }
  getImplementation(context, name2) {
    const { localName: localName2, namespaceURI: namespaceURI2, prefix } = name2;
    const resolvedNamespaceURI = namespaceURI2 ?? context.namespaceResolver.lookupNamespaceURI(prefix ?? FN_NAMESPACE_URI);
    if (resolvedNamespaceURI == null) {
      return this.getDefaultImplementation(localName2);
    }
    const functionLibrary = this.namespacedFunctionLibraries.get(resolvedNamespaceURI);
    if (functionLibrary == null) {
      throw new UnknownFunctionLibraryError(resolvedNamespaceURI);
    }
    return functionLibrary.getImplementation(localName2);
  }
};

// src/xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts
var ANY_TYPE = 0;
var NUMBER_TYPE = 1;
var STRING_TYPE = 2;
var BOOLEAN_TYPE = 3;
var UNORDERED_NODE_ITERATOR_TYPE = 4;
var ORDERED_NODE_ITERATOR_TYPE = 5;
var UNORDERED_NODE_SNAPSHOT_TYPE = 6;
var ORDERED_NODE_SNAPSHOT_TYPE = 7;
var ANY_UNORDERED_NODE_TYPE = 8;
var FIRST_ORDERED_NODE_TYPE = 9;
var XPATH_EVALUATION_RESULT = {
  ANY_TYPE,
  ANY_UNORDERED_NODE_TYPE,
  BOOLEAN_TYPE,
  FIRST_ORDERED_NODE_TYPE,
  NUMBER_TYPE,
  ORDERED_NODE_ITERATOR_TYPE,
  ORDERED_NODE_SNAPSHOT_TYPE,
  STRING_TYPE,
  UNORDERED_NODE_ITERATOR_TYPE,
  UNORDERED_NODE_SNAPSHOT_TYPE
};

// src/xpath/vendor/xpath/evaluator/result/BaseResult.ts
var {
  ANY_TYPE: ANY_TYPE2,
  NUMBER_TYPE: NUMBER_TYPE2,
  STRING_TYPE: STRING_TYPE2,
  BOOLEAN_TYPE: BOOLEAN_TYPE2,
  UNORDERED_NODE_ITERATOR_TYPE: UNORDERED_NODE_ITERATOR_TYPE2,
  ORDERED_NODE_ITERATOR_TYPE: ORDERED_NODE_ITERATOR_TYPE2,
  UNORDERED_NODE_SNAPSHOT_TYPE: UNORDERED_NODE_SNAPSHOT_TYPE2,
  ORDERED_NODE_SNAPSHOT_TYPE: ORDERED_NODE_SNAPSHOT_TYPE2,
  ANY_UNORDERED_NODE_TYPE: ANY_UNORDERED_NODE_TYPE2,
  FIRST_ORDERED_NODE_TYPE: FIRST_ORDERED_NODE_TYPE2
} = XPATH_EVALUATION_RESULT;
var BaseResult = class {
  static ANY_TYPE = ANY_TYPE2;
  static NUMBER_TYPE = NUMBER_TYPE2;
  static STRING_TYPE = STRING_TYPE2;
  static BOOLEAN_TYPE = BOOLEAN_TYPE2;
  static UNORDERED_NODE_ITERATOR_TYPE = UNORDERED_NODE_ITERATOR_TYPE2;
  static ORDERED_NODE_ITERATOR_TYPE = ORDERED_NODE_ITERATOR_TYPE2;
  static UNORDERED_NODE_SNAPSHOT_TYPE = UNORDERED_NODE_SNAPSHOT_TYPE2;
  static ORDERED_NODE_SNAPSHOT_TYPE = ORDERED_NODE_SNAPSHOT_TYPE2;
  static ANY_UNORDERED_NODE_TYPE = ANY_UNORDERED_NODE_TYPE2;
  static FIRST_ORDERED_NODE_TYPE = FIRST_ORDERED_NODE_TYPE2;
  ANY_TYPE = ANY_TYPE2;
  NUMBER_TYPE = NUMBER_TYPE2;
  STRING_TYPE = STRING_TYPE2;
  BOOLEAN_TYPE = BOOLEAN_TYPE2;
  UNORDERED_NODE_ITERATOR_TYPE = UNORDERED_NODE_ITERATOR_TYPE2;
  ORDERED_NODE_ITERATOR_TYPE = ORDERED_NODE_ITERATOR_TYPE2;
  UNORDERED_NODE_SNAPSHOT_TYPE = UNORDERED_NODE_SNAPSHOT_TYPE2;
  ORDERED_NODE_SNAPSHOT_TYPE = ORDERED_NODE_SNAPSHOT_TYPE2;
  ANY_UNORDERED_NODE_TYPE = ANY_UNORDERED_NODE_TYPE2;
  FIRST_ORDERED_NODE_TYPE = FIRST_ORDERED_NODE_TYPE2;
};

// src/xpath/vendor/xpath/evaluator/result/PrimitiveResult.ts
var InvalidNodeSetResultError = class extends Error {
  constructor() {
    super("Result is not a NodeSet");
  }
};
var PrimitiveResult = class extends BaseResult {
  get singleNodeValue() {
    throw new InvalidNodeSetResultError();
  }
  get snapshotLength() {
    throw new InvalidNodeSetResultError();
  }
  invalidIteratorState = true;
  iterateNext() {
    throw new InvalidNodeSetResultError();
  }
  snapshotItem(_index) {
    throw new InvalidNodeSetResultError();
  }
};

// src/xpath/vendor/xpath/evaluator/result/BooleanResult.ts
var BooleanResult = class extends PrimitiveResult {
  nodes = null;
  resultType = PrimitiveResult.BOOLEAN_TYPE;
  booleanValue;
  numberValue;
  stringValue;
  constructor(evaluation) {
    super();
    this.booleanValue = evaluation.toBoolean();
    this.numberValue = evaluation.toNumber();
    this.stringValue = evaluation.toString();
  }
};

// src/xpath/vendor/xpath/evaluator/result/NodeSetResult.ts
var NodeSetResult = class extends BaseResult {
  constructor(domProvider, value) {
    super();
    this.domProvider = domProvider;
    this.nodes = value;
  }
  domProvider;
  nodes;
  computedBooleanValue = null;
  computedNumberValue = null;
  computedStringValue = null;
  get booleanValue() {
    const { computedBooleanValue } = this.compute();
    return computedBooleanValue;
  }
  get numberValue() {
    const { computedNumberValue } = this.compute();
    return computedNumberValue;
  }
  get stringValue() {
    const { computedStringValue } = this.compute();
    return computedStringValue;
  }
  computedSnapshotValue = null;
  compute() {
    let { computedBooleanValue, computedNumberValue, computedStringValue } = this;
    if (computedBooleanValue == null || computedNumberValue == null || computedStringValue == null) {
      const { singleNodeValue } = this;
      if (singleNodeValue == null) {
        computedStringValue = "";
      } else {
        computedStringValue = this.domProvider.getNodeValue(singleNodeValue);
      }
      const isBlank = computedStringValue === "";
      computedBooleanValue = !isBlank;
      computedNumberValue = isBlank ? NaN : Number(computedStringValue);
    }
    return {
      computedBooleanValue,
      computedNumberValue,
      computedStringValue
    };
  }
};
var NodeSetSnapshotResult = class extends NodeSetResult {
  constructor(domProvider, resultType, nodes) {
    const snapshot = Array.from(nodes);
    super(domProvider, nodes);
    this.resultType = resultType;
    const snapshotIterator = nodes.values();
    this.snapshot = snapshot;
    this.snapshotIterator = snapshotIterator;
    this.snapshotLength = snapshot.length;
    this.singleNodeValue = snapshot[0] ?? null;
  }
  resultType;
  // Exposed for convenience
  snapshot;
  // Exposed for convenience
  snapshotIterator;
  snapshotLength;
  // TODO: validity in spec/native likely refers to DOM mutation...?
  invalidIteratorState = false;
  singleNodeValue;
  iterateNext() {
    const next = this.snapshotIterator.next();
    if (next.done) {
      return null;
    }
    return next.value;
  }
  snapshotItem(index) {
    return this.snapshot[index] ?? null;
  }
};
var InvalidSnapshotError = class extends Error {
  constructor() {
    super("Result is not a snapshot");
  }
};
var NodeSetIteratorResult = class extends NodeSetResult {
  constructor(domProvider, resultType, nodes) {
    super(domProvider, nodes);
    this.resultType = resultType;
    this.activeIterator = nodes.values();
  }
  resultType;
  activeIterator;
  // TODO: validity in spec/native likely refers to DOM mutation...?
  invalidIteratorState = false;
  computedSingleNodeValue = void 0;
  get singleNodeValue() {
    let { computedSingleNodeValue } = this;
    if (typeof computedSingleNodeValue === "undefined") {
      computedSingleNodeValue = null;
      for (const node of this.nodes) {
        computedSingleNodeValue = node;
        break;
      }
      this.computedSingleNodeValue = computedSingleNodeValue;
    }
    return computedSingleNodeValue;
  }
  get snapshotLength() {
    throw new InvalidSnapshotError();
  }
  iterateNext() {
    const next = this.activeIterator.next();
    if (next.done) {
      return null;
    }
    return next.value;
  }
  snapshotItem(_index) {
    throw new InvalidSnapshotError();
  }
};

// src/xpath/vendor/xpath/evaluator/result/NumberResult.ts
var NumberResult = class extends PrimitiveResult {
  nodes = null;
  resultType = PrimitiveResult.NUMBER_TYPE;
  booleanValue;
  numberValue;
  stringValue;
  constructor(evaluation) {
    super();
    this.numberValue = evaluation.toNumber();
    this.booleanValue = evaluation.toBoolean();
    this.stringValue = evaluation.toString();
  }
};

// src/xpath/vendor/xpath/evaluator/result/StringResult.ts
var StringResult = class extends PrimitiveResult {
  nodes = null;
  resultType = PrimitiveResult.STRING_TYPE;
  booleanValue;
  numberValue;
  stringValue;
  constructor(evaluation) {
    super();
    this.stringValue = evaluation.toString();
    this.booleanValue = evaluation.toBoolean();
    this.numberValue = evaluation.toNumber();
  }
};

// src/xpath/vendor/xpath/evaluator/result/toXPathEvaluationResult.ts
var {
  ANY_TYPE: ANY_TYPE3,
  NUMBER_TYPE: NUMBER_TYPE3,
  STRING_TYPE: STRING_TYPE3,
  BOOLEAN_TYPE: BOOLEAN_TYPE3,
  UNORDERED_NODE_ITERATOR_TYPE: UNORDERED_NODE_ITERATOR_TYPE3,
  ORDERED_NODE_ITERATOR_TYPE: ORDERED_NODE_ITERATOR_TYPE3,
  UNORDERED_NODE_SNAPSHOT_TYPE: UNORDERED_NODE_SNAPSHOT_TYPE3,
  ORDERED_NODE_SNAPSHOT_TYPE: ORDERED_NODE_SNAPSHOT_TYPE3,
  ANY_UNORDERED_NODE_TYPE: ANY_UNORDERED_NODE_TYPE3,
  FIRST_ORDERED_NODE_TYPE: FIRST_ORDERED_NODE_TYPE3
} = XPATH_EVALUATION_RESULT;
var toXPathEvaluationResult = (domProvider, resultType, evaluation) => {
  const { nodes } = evaluation;
  switch (resultType) {
    case ANY_TYPE3:
      switch (evaluation.type) {
        case "BOOLEAN":
          return new BooleanResult(evaluation);
        case "NUMBER":
          return new NumberResult(evaluation);
        case "STRING":
          return new StringResult(evaluation);
        case "NODE": {
          return new NodeSetIteratorResult(
            domProvider,
            UNORDERED_NODE_ITERATOR_TYPE3,
            evaluation.nodes ?? /* @__PURE__ */ new Set()
          );
        }
        default:
          throw new UnreachableError(evaluation.type);
      }
    case BOOLEAN_TYPE3:
      return new BooleanResult(evaluation);
    case NUMBER_TYPE3:
      return new NumberResult(evaluation);
    case STRING_TYPE3:
      return new StringResult(evaluation);
    case UNORDERED_NODE_ITERATOR_TYPE3:
    case ORDERED_NODE_ITERATOR_TYPE3:
    case ANY_UNORDERED_NODE_TYPE3:
    case FIRST_ORDERED_NODE_TYPE3:
      if (nodes == null) {
        throw new Error("Expected a node-set for node iterator result, but received null.");
      }
      return new NodeSetIteratorResult(domProvider, resultType, nodes);
    case UNORDERED_NODE_SNAPSHOT_TYPE3:
    case ORDERED_NODE_SNAPSHOT_TYPE3:
      if (nodes == null) {
        throw new Error("Expected a node-set for node snapshot result, but received null.");
      }
      return new NodeSetSnapshotResult(domProvider, resultType, nodes);
    default:
      throw new UnreachableError(resultType);
  }
};

// src/xpath/vendor/xpath/evaluator/Evaluator.ts
var functions = new FunctionLibraryCollection([fn]);
var Evaluator = class {
  domProvider;
  // TODO: see notes on cache in `ExpressionParser.ts`, update or remove those
  // if this usage changes in a way that addresses concerns expressed there.
  parser;
  functions;
  parseOptions;
  rootNode;
  timeZone;
  constructor(options) {
    const rootNode = options.rootNode ?? null;
    const { domAdapter, parseOptions = {}, timeZoneId } = options;
    const domProvider = xpathDOMProvider(domAdapter);
    if (rootNode != null) {
      domProvider.assertParentNode(rootNode, "Invalid root node");
    }
    this.domProvider = domProvider;
    this.rootNode = rootNode;
    this.functions = options.functions ?? functions;
    this.parseOptions = parseOptions;
    this.parser = options.parser;
    this.timeZone = timeZoneId ?? Temporal.Now.timeZoneId();
  }
  /**
   * @package - exposed for testing
   */
  getEvaluationContext(contextNode, namespaceResolver) {
    const contextOptions = {
      rootNode: this.rootNode,
      namespaceResolver
    };
    this.domProvider.assertXPathNode(contextNode);
    return new EvaluationContext(this, contextNode, contextOptions);
  }
  evaluate(expression, contextNode, namespaceResolver, resultType) {
    const tree = this.parser.parse(expression, this.parseOptions);
    const expr = createExpression(tree.rootNode);
    const evaluationContext = this.getEvaluationContext(contextNode, namespaceResolver);
    const results = expr.evaluate(evaluationContext);
    return toXPathEvaluationResult(
      this.domProvider,
      resultType ?? XPATH_EVALUATION_RESULT.ANY_TYPE,
      results
    );
  }
  getContextNode(options) {
    const contextNode = options.contextNode ?? this.rootNode;
    if (contextNode == null) {
      throw new Error(
        "Context node must be provided in options or as Evaluator constructor options.rootNode"
      );
    }
    return contextNode;
  }
  evaluateBoolean(expression, options = {}) {
    const contextNode = this.getContextNode(options);
    return this.evaluate(expression, contextNode, null, XPATH_EVALUATION_RESULT.BOOLEAN_TYPE).booleanValue;
  }
  evaluateNumber(expression, options = {}) {
    const contextNode = this.getContextNode(options);
    return this.evaluate(expression, contextNode, null, XPATH_EVALUATION_RESULT.NUMBER_TYPE).numberValue;
  }
  evaluateString(expression, options = {}) {
    const contextNode = this.getContextNode(options);
    return this.evaluate(expression, contextNode, null, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
  }
  evaluateNode(expression, options = {}) {
    const contextNode = this.getContextNode(options);
    const node = this.evaluate(
      expression,
      contextNode,
      null,
      XPATH_EVALUATION_RESULT.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;
    if (!options.assertExists) {
      return node;
    }
    if (node == null) {
      throw new Error(`Failed to evaluate node for expression ${expression}`);
    }
    return node;
  }
  evaluateElement(expression, options = {}) {
    return this.evaluateNode(expression, options);
  }
  evaluateNonNullElement(expression, options = {}) {
    return this.evaluateElement(expression, {
      ...options,
      assertExists: true
    });
  }
  evaluateNodes(expression, options = {}) {
    const contextNode = this.getContextNode(options);
    const snapshotResult = this.evaluate(
      expression,
      contextNode,
      null,
      XPATH_EVALUATION_RESULT.ORDERED_NODE_SNAPSHOT_TYPE
    );
    const { snapshotLength } = snapshotResult;
    const nodes = [];
    for (let i = 0; i < snapshotLength; i += 1) {
      nodes.push(
        // TODO: unsafe cast
        snapshotResult.snapshotItem(i)
      );
    }
    return nodes;
  }
};

// src/xpath/parser/SyntaxNode.ts
function hasSyntaxOffsets(node) {
  return "_startOffset" in node;
}
function makeSyntaxNode(type, text, children, startOffset, endOffset2) {
  const hasOffsets = startOffset !== void 0 && endOffset2 !== void 0;
  const base = {
    type,
    text,
    childCount: children.length,
    children: Object.freeze([...children]),
    child(index) {
      return children[index] ?? null;
    }
  };
  const node = hasOffsets ? Object.freeze({ ...base, _startOffset: startOffset, _endOffset: endOffset2 }) : Object.freeze(base);
  return node;
}

// src/xpath/parser/Tokenizer.ts
var NODE_TYPE_KEYWORDS = /* @__PURE__ */ new Set(["comment", "text", "processing-instruction", "node"]);
var AXIS_NAMES = /* @__PURE__ */ new Set([
  "ancestor",
  "ancestor-or-self",
  "attribute",
  "child",
  "descendant",
  "descendant-or-self",
  "following",
  "following-sibling",
  "namespace",
  "parent",
  "preceding",
  "preceding-sibling",
  "self"
]);
var OPERAND_KINDS = /* @__PURE__ */ new Set([
  "NUMBER" /* NUMBER */,
  "STRING" /* STRING */,
  "NAME" /* NAME */,
  "WILDCARD" /* WILDCARD */,
  "PREFIXED_WILDCARD" /* PREFIXED_WILDCARD */,
  "RPAREN" /* RPAREN */,
  "RBRACKET" /* RBRACKET */,
  "NODE_TYPE" /* NODE_TYPE */,
  "FUNCTION_NAME" /* FUNCTION_NAME */,
  "AXIS_NAME" /* AXIS_NAME */
]);
function isAfterOperand(prev) {
  return prev !== null && OPERAND_KINDS.has(prev.kind);
}
var NUMBER_RE = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)/;
var NCNAME_RE = /^[A-Za-z_][A-Za-z0-9._-]*/;
function tokenize(expression) {
  const tokens = [];
  let pos = 0;
  let prev = null;
  const push = (kind, text, start) => {
    const t = { kind, text, start };
    tokens.push(t);
    prev = t;
  };
  while (pos < expression.length) {
    const wsMatch = /^\s+/.exec(expression.slice(pos));
    if (wsMatch) {
      pos += wsMatch[0].length;
      continue;
    }
    const ch = expression[pos];
    if (ch === void 0) break;
    const two = expression.slice(pos, pos + 2);
    if (two === "//") {
      push("SLASHSLASH" /* SLASHSLASH */, "//", pos);
      pos += 2;
      continue;
    }
    if (two === "::") {
      push("COLON_COLON" /* COLON_COLON */, "::", pos);
      pos += 2;
      continue;
    }
    if (two === "..") {
      push("DOTDOT" /* DOTDOT */, "..", pos);
      pos += 2;
      continue;
    }
    if (two === "!=") {
      push("NEQ" /* NEQ */, "!=", pos);
      pos += 2;
      continue;
    }
    if (two === "<=") {
      push("LTE" /* LTE */, "<=", pos);
      pos += 2;
      continue;
    }
    if (two === ">=") {
      push("GTE" /* GTE */, ">=", pos);
      pos += 2;
      continue;
    }
    switch (ch) {
      case "/":
        push("SLASH" /* SLASH */, "/", pos++);
        continue;
      case "+":
        push("PLUS" /* PLUS */, "+", pos++);
        continue;
      case "-":
        push("MINUS" /* MINUS */, "-", pos++);
        continue;
      case "=":
        push("EQ" /* EQ */, "=", pos++);
        continue;
      case "<":
        push("LT" /* LT */, "<", pos++);
        continue;
      case ">":
        push("GT" /* GT */, ">", pos++);
        continue;
      case "|":
        push("PIPE" /* PIPE */, "|", pos++);
        continue;
      case "(":
        push("LPAREN" /* LPAREN */, "(", pos++);
        continue;
      case ")":
        push("RPAREN" /* RPAREN */, ")", pos++);
        continue;
      case "[":
        push("LBRACKET" /* LBRACKET */, "[", pos++);
        continue;
      case "]":
        push("RBRACKET" /* RBRACKET */, "]", pos++);
        continue;
      case ",":
        push("COMMA" /* COMMA */, ",", pos++);
        continue;
      case "@":
        push("AT" /* AT */, "@", pos++);
        continue;
      case "$":
        push("DOLLAR" /* DOLLAR */, "$", pos++);
        continue;
      case ".": {
        if (expression[pos + 1] !== void 0 && /[0-9]/.test(expression[pos + 1])) break;
        push("DOT" /* DOT */, ".", pos++);
        continue;
      }
    }
    if (ch === "*") {
      if (isAfterOperand(prev)) {
        push("MULTIPLY" /* MULTIPLY */, "*", pos++);
      } else {
        push("WILDCARD" /* WILDCARD */, "*", pos++);
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = pos++;
      while (pos < expression.length && expression[pos] !== quote) {
        pos++;
      }
      if (pos >= expression.length) {
        throw new Error(`Unterminated string literal in XPath: ${expression}`);
      }
      pos++;
      push("STRING" /* STRING */, expression.slice(start, pos), start);
      continue;
    }
    const numMatch = NUMBER_RE.exec(expression.slice(pos));
    if (numMatch) {
      push("NUMBER" /* NUMBER */, numMatch[0], pos);
      pos += numMatch[0].length;
      continue;
    }
    const nameMatch = NCNAME_RE.exec(expression.slice(pos));
    if (nameMatch) {
      const rawName = nameMatch[0];
      const start = pos;
      pos += rawName.length;
      if (expression[pos] === ":" && expression[pos + 1] !== ":") {
        const colon = pos;
        pos++;
        if (expression[pos] === "*") {
          pos++;
          push("PREFIXED_WILDCARD" /* PREFIXED_WILDCARD */, `${rawName}:*`, start);
          continue;
        }
        const localMatch = NCNAME_RE.exec(expression.slice(pos));
        if (localMatch) {
          pos += localMatch[0].length;
          const qname = `${rawName}:${localMatch[0]}`;
          let qla = pos;
          while (qla < expression.length && /\s/.test(expression[qla])) qla++;
          if (expression[qla] === "(") {
            push("FUNCTION_NAME" /* FUNCTION_NAME */, qname, start);
          } else {
            push("NAME" /* NAME */, qname, start);
          }
          continue;
        }
        pos = colon;
      }
      let la = pos;
      while (la < expression.length && /\s/.test(expression[la])) la++;
      const nextCh = expression[la];
      if (expression[la] === ":" && expression[la + 1] === ":" && AXIS_NAMES.has(rawName)) {
        push("AXIS_NAME" /* AXIS_NAME */, rawName, start);
        continue;
      }
      if (isAfterOperand(prev)) {
        if (rawName === "div") {
          push("DIV" /* DIV */, rawName, start);
          continue;
        }
        if (rawName === "mod") {
          push("MOD" /* MOD */, rawName, start);
          continue;
        }
        if (rawName === "and") {
          push("AND" /* AND */, rawName, start);
          continue;
        }
        if (rawName === "or") {
          push("OR" /* OR */, rawName, start);
          continue;
        }
      }
      if (nextCh === "(") {
        if (NODE_TYPE_KEYWORDS.has(rawName)) {
          push("NODE_TYPE" /* NODE_TYPE */, rawName, start);
        } else {
          push("FUNCTION_NAME" /* FUNCTION_NAME */, rawName, start);
        }
        continue;
      }
      push("NAME" /* NAME */, rawName, start);
      continue;
    }
    throw new Error(
      `Unexpected character '${ch}' at position ${pos} in XPath expression: ${expression}`
    );
  }
  push("EOF" /* EOF */, "", pos);
  return tokens;
}

// src/xpath/parser/PureJSExpressionParser.ts
var LRUCache = class {
  constructor(maxSize) {
    this.maxSize = maxSize;
  }
  maxSize;
  map = /* @__PURE__ */ new Map();
  get(key) {
    const v = this.map.get(key);
    if (v !== void 0) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      this.map.delete(this.map.keys().next().value);
    }
  }
};
var PureJSExpressionParser = class {
  cache = new LRUCache(256);
  parse(expression, _options) {
    const cached = this.cache.get(expression);
    if (cached !== void 0) return cached;
    const tokens = tokenize(expression);
    const parser = new Parser(expression, tokens);
    const result = parser.parseRoot();
    this.cache.set(expression, result);
    return result;
  }
};
var Parser = class {
  constructor(src, tokens) {
    this.src = src;
    this.tokens = tokens;
  }
  src;
  tokens;
  pos = 0;
  // -------------------------------------------------------------------------
  // Token navigation
  // -------------------------------------------------------------------------
  peek() {
    return this.tokens[this.pos] ?? { kind: "EOF" /* EOF */, text: "", start: this.src.length };
  }
  peekKind() {
    return this.peek().kind;
  }
  advance() {
    const t = this.peek();
    if (t.kind !== "EOF" /* EOF */) this.pos++;
    return t;
  }
  expect(kind) {
    const t = this.peek();
    if (t.kind !== kind) {
      this.error();
    }
    return this.advance();
  }
  consume(kind) {
    if (this.peekKind() === kind) return this.advance();
    return null;
  }
  error() {
    throw new Error(`Expression has syntax error: ${this.src}`);
  }
  // -------------------------------------------------------------------------
  // Root
  // -------------------------------------------------------------------------
  parseRoot() {
    const exprNode = this.parseExprWrapper();
    if (this.peekKind() !== "EOF" /* EOF */) {
      this.error();
    }
    const xpathNode = makeSyntaxNode("xpath", this.src, [exprNode]);
    return { rootNode: xpathNode };
  }
  /**
   * Produce an `expr` wrapper node around the actual expression, matching
   * tree-sitter's invariant that `xpath` always has exactly one `expr` child
   * and `argument` always wraps in `expr`.
   */
  parseExprWrapper() {
    const inner = this.parseOrExpr();
    return makeSyntaxNode("expr", inner.text, [inner]);
  }
  // -------------------------------------------------------------------------
  // Binary expression chain (precedence climbing)
  // The grammar precedence (low to high binding):
  //   or < and < equality < relational < additive < multiplicative < unary
  // After these: union, path, filter expressions
  // -------------------------------------------------------------------------
  parseOrExpr() {
    let left = this.parseAndExpr();
    while (this.peekKind() === "OR" /* OR */) {
      this.advance();
      const right = this.parseAndExpr();
      left = makeBinaryNode("or_expr", this.src, left, right);
    }
    return left;
  }
  parseAndExpr() {
    let left = this.parseEqualityExpr();
    while (this.peekKind() === "AND" /* AND */) {
      this.advance();
      const right = this.parseEqualityExpr();
      left = makeBinaryNode("and_expr", this.src, left, right);
    }
    return left;
  }
  parseEqualityExpr() {
    let left = this.parseRelationalExpr();
    for (; ; ) {
      const k = this.peekKind();
      if (k === "EQ" /* EQ */) {
        this.advance();
        const right = this.parseRelationalExpr();
        left = makeBinaryNode("eq_expr", this.src, left, right);
      } else if (k === "NEQ" /* NEQ */) {
        this.advance();
        const right = this.parseRelationalExpr();
        left = makeBinaryNode("ne_expr", this.src, left, right);
      } else {
        break;
      }
    }
    return left;
  }
  parseRelationalExpr() {
    let left = this.parseAdditiveExpr();
    for (; ; ) {
      const k = this.peekKind();
      if (k === "LT" /* LT */) {
        this.advance();
        const right = this.parseAdditiveExpr();
        left = makeBinaryNode("lt_expr", this.src, left, right);
      } else if (k === "LTE" /* LTE */) {
        this.advance();
        const right = this.parseAdditiveExpr();
        left = makeBinaryNode("lte_expr", this.src, left, right);
      } else if (k === "GT" /* GT */) {
        this.advance();
        const right = this.parseAdditiveExpr();
        left = makeBinaryNode("gt_expr", this.src, left, right);
      } else if (k === "GTE" /* GTE */) {
        this.advance();
        const right = this.parseAdditiveExpr();
        left = makeBinaryNode("gte_expr", this.src, left, right);
      } else {
        break;
      }
    }
    return left;
  }
  parseAdditiveExpr() {
    let left = this.parseMultiplicativeExpr();
    for (; ; ) {
      const k = this.peekKind();
      if (k === "PLUS" /* PLUS */) {
        this.advance();
        const right = this.parseMultiplicativeExpr();
        left = makeBinaryNode("addition_expr", this.src, left, right);
      } else if (k === "MINUS" /* MINUS */) {
        this.advance();
        const right = this.parseMultiplicativeExpr();
        left = makeBinaryNode("subtraction_expr", this.src, left, right);
      } else {
        break;
      }
    }
    return left;
  }
  parseMultiplicativeExpr() {
    let left = this.parseUnaryExpr();
    for (; ; ) {
      const k = this.peekKind();
      if (k === "MULTIPLY" /* MULTIPLY */) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = makeBinaryNode("multiplication_expr", this.src, left, right);
      } else if (k === "DIV" /* DIV */) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = makeBinaryNode("division_expr", this.src, left, right);
      } else if (k === "MOD" /* MOD */) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = makeBinaryNode("modulo_expr", this.src, left, right);
      } else {
        break;
      }
    }
    return left;
  }
  parseUnaryExpr() {
    if (this.peekKind() === "MINUS" /* MINUS */) {
      const minusTok = this.advance();
      const operand = this.parseUnionOperand();
      const fpe = wrapInFilterPathExpr(operand);
      const text = this.src.slice(minusTok.start, endOffset(fpe, this.src));
      return makeSyntaxNode("unary_expr", text, [fpe]);
    }
    return this.parseUnionOperand();
  }
  /**
   * Parse a union expression or a single path/filter expression.
   * Union: PathExpr | PathExpr | ...
   * This is the level above path expressions in the precedence chain.
   */
  parseUnionOperand() {
    let left = this.parsePathExpr();
    while (this.peekKind() === "PIPE" /* PIPE */) {
      this.advance();
      const right = this.parsePathExpr();
      left = makeBinaryNode("union_expr", this.src, left, right);
    }
    return left;
  }
  // -------------------------------------------------------------------------
  // Path / Filter expressions
  // -------------------------------------------------------------------------
  /**
   * PathExpr ::= LocationPath | FilterExpr | FilterExpr '/' RelativeLocationPath
   *             | FilterExpr '//' RelativeLocationPath
   *
   * In tree-sitter, simple function calls and literals are wrapped as:
   *   filter_path_expr > filter_expr > (function_call | literal | number | expr)
   * Location paths are NOT wrapped in filter_path_expr at the top level.
   */
  parsePathExpr() {
    if (this.peekKind() === "SLASH" /* SLASH */ || this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      return this.parseAbsoluteLocationPath();
    }
    if (this.isStepStart()) {
      return this.parseRelativeLocationPath();
    }
    const filterExprNode = this.parseFilterExpr();
    const filterPathNode = wrapInFilterPathExpr(filterExprNode);
    if (this.peekKind() === "SLASH" /* SLASH */ || this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      return this.parseFilterPathContinuation(filterPathNode);
    }
    return filterPathNode;
  }
  parseFilterPathContinuation(head) {
    const children = [head];
    while (this.peekKind() === "SLASH" /* SLASH */ || this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      if (this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
        this.advance();
        children.push(makeSyntaxNode("//", "//", []));
        const step = this.parseStep();
        children.push(step);
      } else {
        this.advance();
        const step = this.parseStep();
        children.push(step);
      }
    }
    const text = this.src.slice(
      findNodeStart(children[0], this.src),
      endOffsetFromChildren(children, this.src)
    );
    return makeSyntaxNode("filter_path_expr", text, children);
  }
  /**
   * Parse an absolute location path.
   * / RelativeLocationPath?
   * // RelativeLocationPath
   */
  parseAbsoluteLocationPath() {
    if (this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      return this.parseAbbreviatedAbsoluteLocationPath();
    }
    const slashTok = this.advance();
    const rootNode = makeSyntaxNode("absolute_root_location_path", "/", []);
    const children = [rootNode];
    if (this.isStepStart()) {
      const relSteps = this.parseRelativeSteps();
      children.push(...relSteps);
    }
    const text = this.src.slice(slashTok.start, endOffsetFromChildren(children, this.src));
    return makeSyntaxNode("absolute_location_path", text, children);
  }
  /**
   * Parse //RelativeLocationPath → absolute_location_path > abbreviated_absolute_location_path
   */
  parseAbbreviatedAbsoluteLocationPath() {
    const slashSlashTok = this.advance();
    const slashSlashLiteral = makeSyntaxNode("//", "//", []);
    const firstStep = this.parseStep();
    const abbrevChildren = [slashSlashLiteral, firstStep];
    while (this.peekKind() === "SLASH" /* SLASH */ || this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      if (this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
        this.advance();
        abbrevChildren.push(makeSyntaxNode("//", "//", []));
      } else {
        this.advance();
      }
      if (this.isStepStart()) {
        abbrevChildren.push(this.parseStep());
      }
    }
    const abbrevText = this.src.slice(slashSlashTok.start, endOffsetFromChildren(abbrevChildren, this.src));
    const abbrevNode = makeSyntaxNode("abbreviated_absolute_location_path", abbrevText, abbrevChildren);
    const absText = abbrevText;
    return makeSyntaxNode("absolute_location_path", absText, [abbrevNode]);
  }
  /**
   * Parse a relative location path: step (/ step | // step)*
   */
  parseRelativeLocationPath() {
    const steps = this.parseRelativeSteps();
    const text = this.src.slice(
      findNodeStart(steps[0], this.src),
      endOffsetFromChildren(steps, this.src)
    );
    return makeSyntaxNode("relative_location_path", text, steps);
  }
  /**
   * Parse one or more step nodes, interleaved with / and // separators.
   * Returns a flat array of steps (// is NOT included as a separator node here —
   * only `abbreviated_absolute_location_path` uses `//` as a sibling node).
   *
   * In `relative_location_path`, `//` becomes a `NodeTypeTestStep('descendant-or-self')`
   * in the evaluator via the `//` sibling node in the children array.
   * Wait — let's check the actual tree shape for `foo//bar`:
   */
  parseRelativeSteps() {
    const steps = [];
    steps.push(this.parseStep());
    while (this.peekKind() === "SLASH" /* SLASH */ || this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
      if (this.peekKind() === "SLASHSLASH" /* SLASHSLASH */) {
        this.advance();
        steps.push(makeSyntaxNode("//", "//", []));
      } else {
        this.advance();
      }
      if (this.isStepStart()) {
        steps.push(this.parseStep());
      } else if (steps.length > 0) {
        this.error();
      }
    }
    return steps;
  }
  /**
   * Determine if the current token can start a step.
   * FUNCTION_NAME is NOT a step start — it is a function call and goes through
   * the FilterExpr path.
   * NODE_TYPE is a step start only when it is inside a step context (always true
   * for a relative location path, but not at the top-level expression level where
   * it would be a function call like node()).
   * Actually NODE_TYPE at the top-level becomes a relative_location_path too
   * (e.g. `node()` is a step test). So NODE_TYPE is a step start.
   */
  isStepStart() {
    const k = this.peekKind();
    return k === "NAME" /* NAME */ || k === "WILDCARD" /* WILDCARD */ || k === "PREFIXED_WILDCARD" /* PREFIXED_WILDCARD */ || k === "AT" /* AT */ || k === "DOT" /* DOT */ || k === "DOTDOT" /* DOTDOT */ || k === "AXIS_NAME" /* AXIS_NAME */ || k === "NODE_TYPE" /* NODE_TYPE */;
  }
  /**
   * Parse a single step node.
   * Step shapes:
   *   abbreviated_step (`.` or `..`)
   *   node_test (implicit child:: axis)
   *   axis_test (explicit axis via AxisName `::`)
   *   abbreviated_axis_test (@ shorthand)
   */
  parseStep() {
    this.peek().start;
    if (this.peekKind() === "DOTDOT" /* DOTDOT */) {
      this.advance();
      const parentNode = makeSyntaxNode("parent", "..", []);
      const abbrev = makeSyntaxNode("abbreviated_step", "..", [parentNode]);
      return makeSyntaxNode("step", "..", [abbrev]);
    }
    if (this.peekKind() === "DOT" /* DOT */) {
      this.advance();
      const selfNode = makeSyntaxNode("self", ".", []);
      const abbrev = makeSyntaxNode("abbreviated_step", ".", [selfNode]);
      return makeSyntaxNode("step", ".", [abbrev]);
    }
    if (this.peekKind() === "AT" /* AT */) {
      this.advance();
      const nameTest2 = this.parseNameTestNode();
      const abbrevAxis = makeSyntaxNode("abbreviated_axis_test", `@${nameTest2.text}`, [nameTest2]);
      const stepText = `@${nameTest2.text}`;
      const children2 = [abbrevAxis, ...this.parsePredicates()];
      const text2 = buildStepText(this.src, stepText, children2);
      return makeSyntaxNode("step", text2, children2);
    }
    if (this.peekKind() === "AXIS_NAME" /* AXIS_NAME */) {
      const axisTok = this.advance();
      this.expect("COLON_COLON" /* COLON_COLON */);
      const axisNameNode = makeSyntaxNode("axis_name", axisTok.text, []);
      const axisTestContent = this.parseAxisTestContent();
      const axisTestText = `${axisTok.text}::${axisTestContent.text}`;
      const axisTestNode = makeSyntaxNode("axis_test", axisTestText, [axisNameNode, axisTestContent]);
      const children2 = [axisTestNode, ...this.parsePredicates()];
      const text2 = buildStepText(this.src, axisTestText, children2);
      return makeSyntaxNode("step", text2, children2);
    }
    if (this.peekKind() === "NODE_TYPE" /* NODE_TYPE */) {
      const typeTok = this.advance();
      this.expect("LPAREN" /* LPAREN */);
      let piName = null;
      if (typeTok.text === "processing-instruction" && this.peekKind() === "STRING" /* STRING */) {
        piName = this.advance().text;
      }
      this.expect("RPAREN" /* RPAREN */);
      let nodeTypeNode;
      let nodeTestNode2;
      if (piName !== null) {
        const litNode = makeSyntaxNode("string_literal", piName, []);
        nodeTypeNode = makeSyntaxNode("processing_instruction_name_test", `processing-instruction(${piName})`, [litNode]);
        nodeTestNode2 = makeSyntaxNode("node_test", nodeTypeNode.text, [nodeTypeNode]);
      } else {
        const nodeTypeText = `${typeTok.text}()`;
        nodeTypeNode = makeSyntaxNode("node_type_test", nodeTypeText, []);
        nodeTestNode2 = makeSyntaxNode("node_test", nodeTypeText, [nodeTypeNode]);
      }
      const children2 = [nodeTestNode2, ...this.parsePredicates()];
      const text2 = buildStepText(this.src, nodeTestNode2.text, children2);
      return makeSyntaxNode("step", text2, children2);
    }
    const nameTest = this.parseNameTestNode();
    const nodeTestNode = makeSyntaxNode("node_test", nameTest.text, [nameTest]);
    const children = [nodeTestNode, ...this.parsePredicates()];
    const text = buildStepText(this.src, nameTest.text, children);
    return makeSyntaxNode("step", text, children);
  }
  /**
   * Parse the content after `axis::` — either a name test or a node-type test.
   */
  parseAxisTestContent() {
    if (this.peekKind() === "NODE_TYPE" /* NODE_TYPE */) {
      const typeTok = this.advance();
      this.expect("LPAREN" /* LPAREN */);
      let piName = null;
      if (typeTok.text === "processing-instruction" && this.peekKind() === "STRING" /* STRING */) {
        piName = this.advance().text;
      }
      this.expect("RPAREN" /* RPAREN */);
      if (piName !== null) {
        const litNode = makeSyntaxNode("string_literal", piName, []);
        return makeSyntaxNode("processing_instruction_name_test", `processing-instruction(${piName})`, [litNode]);
      }
      return makeSyntaxNode("node_type_test", `${typeTok.text}()`, []);
    }
    return this.parseNameTestNode();
  }
  /** Parse a name test node: unprefixed_name, unprefixed_wildcard_name_test, or prefixed forms. */
  parseNameTestNode() {
    if (this.peekKind() === "WILDCARD" /* WILDCARD */) {
      this.advance();
      return makeSyntaxNode("unprefixed_wildcard_name_test", "*", []);
    }
    if (this.peekKind() === "PREFIXED_WILDCARD" /* PREFIXED_WILDCARD */) {
      const tok2 = this.advance();
      const colonIdx2 = tok2.text.indexOf(":");
      const prefixText = tok2.text.slice(0, colonIdx2);
      const prefixNode = makeSyntaxNode("prefix", prefixText, []);
      return makeSyntaxNode("prefixed_wildcard_name_test", tok2.text, [prefixNode]);
    }
    const tok = this.advance();
    const colonIdx = tok.text.indexOf(":");
    if (colonIdx > -1) {
      const prefixText = tok.text.slice(0, colonIdx);
      const localText = tok.text.slice(colonIdx + 1);
      const prefixNode = makeSyntaxNode("prefix", prefixText, []);
      const localNode = makeSyntaxNode("local_part", localText, []);
      return makeSyntaxNode("prefixed_name", tok.text, [prefixNode, localNode]);
    }
    return makeSyntaxNode("unprefixed_name", tok.text, []);
  }
  /** Parse zero or more predicate nodes `[expr]`. */
  parsePredicates() {
    const preds = [];
    while (this.peekKind() === "LBRACKET" /* LBRACKET */) {
      this.advance();
      const exprWrapper = this.parseExprWrapper();
      this.expect("RBRACKET" /* RBRACKET */);
      const text = `[${exprWrapper.text}]`;
      preds.push(makeSyntaxNode("predicate", text, [exprWrapper]));
    }
    return preds;
  }
  // -------------------------------------------------------------------------
  // Filter expression (function call, literal, grouped expression)
  // -------------------------------------------------------------------------
  /**
   * FilterExpr ::= PrimaryExpr Predicate*
   * PrimaryExpr ::= '(' Expr ')' | Literal | Number | FunctionCall | VariableReference
   *
   * Returns the innermost node (function_call / string_literal / number / expr).
   * The caller wraps it in filter_expr > filter_path_expr.
   */
  parseFilterExpr() {
    const primary = this.parsePrimaryExpr();
    const preds = this.parsePredicates();
    if (preds.length === 0) return primary;
    const feText = buildConcatText(this.src, [primary, ...preds]);
    return makeSyntaxNode("filter_expr", feText, [primary, ...preds]);
  }
  parsePrimaryExpr() {
    const k = this.peekKind();
    if (k === "LPAREN" /* LPAREN */) {
      this.advance();
      const inner = this.parseExprWrapper();
      this.expect("RPAREN" /* RPAREN */);
      return inner;
    }
    if (k === "STRING" /* STRING */) {
      const tok = this.advance();
      return makeSyntaxNode("string_literal", tok.text, [], tok.start, tok.start + tok.text.length);
    }
    if (k === "NUMBER" /* NUMBER */) {
      const tok = this.advance();
      return makeSyntaxNode("number", tok.text, [], tok.start, tok.start + tok.text.length);
    }
    if (k === "FUNCTION_NAME" /* FUNCTION_NAME */) {
      return this.parseFunctionCall();
    }
    if (k === "DOLLAR" /* DOLLAR */) {
      const dollarTok = this.advance();
      const nameTok = this.expect("NAME" /* NAME */);
      const text = `$${nameTok.text}`;
      return makeSyntaxNode(
        "variable_reference",
        text,
        [],
        dollarTok.start,
        nameTok.start + nameTok.text.length
      );
    }
    if (k === "NAME" /* NAME */) {
      const saved = this.pos;
      const nameTok = this.advance();
      if (this.peekKind() === "LPAREN" /* LPAREN */) {
        this.advance();
        const args = this.parseFunctionArguments();
        this.expect("RPAREN" /* RPAREN */);
        const fnNameInner = makeSyntaxNode("unprefixed_name", nameTok.text, []);
        const fnName = makeSyntaxNode("function_name", nameTok.text, [fnNameInner]);
        const allChildren = [fnName, ...args];
        const text = buildCallText(nameTok.text, args);
        return makeSyntaxNode("function_call", text, allChildren);
      }
      this.pos = saved;
      this.error();
    }
    this.error();
  }
  parseFunctionCall() {
    const nameTok = this.advance();
    this.expect("LPAREN" /* LPAREN */);
    const args = this.parseFunctionArguments();
    this.expect("RPAREN" /* RPAREN */);
    const colonIdx = nameTok.text.indexOf(":");
    let fnNameInner;
    if (colonIdx > -1) {
      const prefixText = nameTok.text.slice(0, colonIdx);
      const localText = nameTok.text.slice(colonIdx + 1);
      const prefixNode = makeSyntaxNode("prefix", prefixText, []);
      const localNode = makeSyntaxNode("local_part", localText, []);
      fnNameInner = makeSyntaxNode("prefixed_name", nameTok.text, [prefixNode, localNode]);
    } else {
      fnNameInner = makeSyntaxNode("unprefixed_name", nameTok.text, []);
    }
    const fnName = makeSyntaxNode("function_name", nameTok.text, [fnNameInner]);
    const allChildren = [fnName, ...args];
    const text = buildCallText(nameTok.text, args);
    return makeSyntaxNode("function_call", text, allChildren);
  }
  parseFunctionArguments() {
    const args = [];
    if (this.peekKind() === "RPAREN" /* RPAREN */) {
      return args;
    }
    const firstExpr = this.parseExprWrapper();
    args.push(makeSyntaxNode("argument", firstExpr.text, [firstExpr]));
    while (this.peekKind() === "COMMA" /* COMMA */) {
      this.advance();
      const argExpr = this.parseExprWrapper();
      args.push(makeSyntaxNode("argument", argExpr.text, [argExpr]));
    }
    return args;
  }
};
function wrapInFilterPathExpr(inner) {
  const filterExpr = makeSyntaxNode("filter_expr", inner.text, [inner]);
  return makeSyntaxNode("filter_path_expr", inner.text, [filterExpr]);
}
function computeBinaryNodeData(src, left, right) {
  if (hasSyntaxOffsets(left) && hasSyntaxOffsets(right)) {
    const start = left._startOffset;
    const end = right._endOffset;
    return { text: src.slice(start, end), startOffset: start, endOffset: end };
  }
  const l = src.indexOf(left.text);
  const rEnd = src.indexOf(right.text, l) + right.text.length;
  const text = l >= 0 && rEnd > l ? src.slice(l, rEnd) : `${left.text} ${right.text}`;
  return { text, startOffset: l >= 0 ? l : 0, endOffset: rEnd };
}
function makeBinaryNode(type, src, left, right) {
  const { text, startOffset, endOffset: endOffset2 } = computeBinaryNodeData(src, left, right);
  return makeSyntaxNode(type, text, [left, right], startOffset, endOffset2);
}
function findNodeStart(node, src) {
  const idx = src.indexOf(node.text);
  return idx >= 0 ? idx : 0;
}
function endOffset(node, src) {
  const idx = src.indexOf(node.text);
  return idx >= 0 ? idx + node.text.length : src.length;
}
function endOffsetFromChildren(children, src) {
  let max2 = 0;
  for (const c of children) {
    const e = endOffset(c, src);
    if (e > max2) max2 = e;
  }
  return max2;
}
function buildStepText(src, base, children) {
  if (children.length <= 1) return base;
  const parts = children.map((c) => c.text);
  return parts.join("");
}
function buildConcatText(src, nodes) {
  return nodes.map((n) => n.text).join("");
}
function buildCallText(name2, args) {
  if (args.length === 0) return `${name2}()`;
  return `${name2}(${args.map((a) => a.text).join(", ")})`;
}

// src/xpath/vendor/xpath/functions/javarosa/select.ts
var select_exports = {};
__export(select_exports, {
  choiceName: () => choiceName
});
var choiceName = new StringFunction(
  "choice-name",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [nodeExpression, valueExpression]) => {
    const node = nodeExpression.evaluate(context).toString();
    const value = valueExpression.evaluate(context).toString();
    const [contextNode] = context.contextNodes;
    const { domProvider } = context;
    let nodes;
    if (contextNode && domProvider.isElement(contextNode)) {
      nodes = context.evaluator.evaluateNodes(value, { contextNode });
    } else {
      nodes = context.evaluator.evaluateNodes(value);
    }
    const firstNode = nodes?.[0];
    if (!firstNode) {
      throw new Error(`No element found by evaluating '${value}'`);
    }
    if (!("getChoiceName" in firstNode)) {
      throw new Error(
        `Evaluating 'jr:choice-name' on element '${value}' which has no possible choices.`
      );
    }
    return firstNode.getChoiceName(node) ?? "";
  }
);

// src/xpath/vendor/xpath/functions/xforms/boolean.ts
var boolean_exports2 = {};
__export(boolean_exports2, {
  booleanFromString: () => booleanFromString,
  checklist: () => checklist,
  weightedChecklist: () => weightedChecklist,
  xfIf: () => xfIf
});
var booleanFromString = new BooleanFunction(
  "boolean-from-string",
  [{ arityType: "required", typeHint: "string" }],
  (context, [expression]) => {
    const value = expression.evaluate(context).toString();
    return value === "1" || value === "true";
  }
);
var checklist = new BooleanFunction(
  "checklist",
  [
    { arityType: "required", typeHint: "number" },
    { arityType: "required", typeHint: "number" },
    { arityType: "variadic" }
  ],
  (context, [minExpression, maxExpression, ...expressions]) => {
    const min2 = minExpression.evaluate(context).toNumber();
    let max2 = maxExpression.evaluate(context).toNumber();
    if (max2 === -1) {
      if (min2 < 1) {
        return true;
      }
      max2 = Infinity;
    }
    let satisfied = 0;
    for (const expression of expressions) {
      const results = expression.evaluate(context).values();
      for (const result of results) {
        if (result.toBoolean()) {
          satisfied += 1;
          if (satisfied > max2) {
            return false;
          }
        }
      }
    }
    return satisfied >= min2;
  }
);
var weightedChecklist = new BooleanFunction(
  "weighted-checklist",
  [
    { arityType: "required", typeHint: "number" },
    { arityType: "required", typeHint: "number" },
    { arityType: "variadic" }
  ],
  (context, [minExpression, maxExpression, ...expressions]) => {
    const min2 = minExpression.evaluate(context).toNumber();
    let max2 = maxExpression.evaluate(context).toNumber();
    if (max2 === -1) {
      if (min2 < 1) {
        return true;
      }
      max2 = Infinity;
    }
    let satisfied = 0;
    for (let i = 0; i < expressions.length; i += 2) {
      const expression = expressions[i];
      const weightExpression = expressions[i + 1];
      if (weightExpression == null) {
        throw new Error(
          "The weighted-checklist function must be given an even number of arguments."
        );
      }
      const results = expression.evaluate(context).values();
      const weights = weightExpression.evaluate(context).values();
      const length = Math.max(results.length, weights.length);
      for (let j = 0; j < length; j += 1) {
        const weight = weights[j];
        if (weight == null) {
          break;
        }
        const result = results[j];
        if (result == null) {
          return false;
        }
        if (result.toBoolean()) {
          satisfied += weight.toNumber();
          if (satisfied > max2) {
            return false;
          }
        }
      }
    }
    return satisfied >= min2;
  }
);
var xfIf = new FunctionImplementation(
  "if",
  [
    { arityType: "required", typeHint: "boolean" },
    { arityType: "required" },
    { arityType: "required" }
  ],
  (context, [conditionExpression, whenTrueExpression, whenFalseExpression]) => {
    const condition = conditionExpression.evaluate(context).toBoolean();
    const expression = condition ? whenTrueExpression : whenFalseExpression;
    return expression.evaluate(context);
  }
);

// src/xpath/vendor/xpath/functions/xforms/datetime.ts
var datetime_exports = {};
__export(datetime_exports, {
  date: () => date,
  decimalDateTime: () => decimalDateTime,
  decimalTime: () => decimalTime,
  formatDate: () => formatDate,
  formatDateTime: () => formatDateTime,
  today: () => today,
  xfNow: () => xfNow
});

// src/xpath/vendor/common/constants/datetime.ts
var DAY_MILLISECONDS = 1e3 * 60 * 60 * 24;
var MILLISECOND_NANOSECONDS = BigInt(1e6);
var ISO_DATE_LIKE_SUBPATTERN = "\\d{4}-\\d{2}-\\d{2}";
var STRICT_TIME_FORMATS = ["\\d{2}:\\d{2}:\\d{2}\\.\\d+", "\\d{2}:\\d{2}:\\d{2}"];
var ISO_TIME_LIKE_SUBPATTERN = `(${[...STRICT_TIME_FORMATS, "\\d{2}:\\d{2}", "\\d{2}"].join(
  "|"
)})`;
var TIMEZONE_OFFSET_SUBPATTERN = "[-+]\\d{2}:\\d{2}";
var TIMEZONE_OFFSET_PATTERN = new RegExp(`${TIMEZONE_OFFSET_SUBPATTERN}$`);
var ISO_OFFSET_SUBPATTERN = `(${TIMEZONE_OFFSET_SUBPATTERN}|Z)`;
var VALID_OFFSET_VALUE = new RegExp("^([+-]([0][0-9]|1[0-4]):([0-5][0-9])|Z)$", "i");
var ISO_DATE_OR_DATE_TIME_LIKE_PATTERN = new RegExp(
  [
    "^",
    ISO_DATE_LIKE_SUBPATTERN,
    `(T${ISO_TIME_LIKE_SUBPATTERN}(${ISO_OFFSET_SUBPATTERN})?)?`,
    "$"
  ].join("")
);

// src/xpath/vendor/xpath/lib/datetime/functions.ts
var localDateTimeString = (dateTime) => {
  const resultDateTime = dateTime.toPlainDateTime().toString().replace(/(\.\d{3})\d+$/, "$1").replace(/(T\d{2}:\d{2}(:\d{2})?)$/, "$1.000");
  return `${resultDateTime}${dateTime.offset}`;
};
var localDateTimeOrDateString = (dateTime) => {
  const dateTimeString = localDateTimeString(dateTime);
  return dateTimeString.replace(/T00:00:00(\.0+)?(Z|[-+]\d{2}:\d{2})?/, "");
};
var now = (timeZone) => Temporal.Now.zonedDateTimeISO(timeZone);

// src/xpath/vendor/xpath/evaluations/DateTimeLikeEvaluation.ts
var INVALID_DATE_TIME_STRING = "Invalid Date";
var DateTimeLikeEvaluation = class extends ValueEvaluation {
  constructor(context, dateTime, precomputedValues = {}) {
    super();
    this.context = context;
    this.dateTime = dateTime;
    const { booleanValue: booleanValue2, numberValue, stringValue: stringValue2 } = precomputedValues;
    if (dateTime == null) {
      this.value = NaN;
      this.booleanValue = booleanValue2 ?? false;
      this.numberValue = numberValue ?? NaN;
      this.milliseconds = NaN;
      this.dateString = INVALID_DATE_TIME_STRING;
      this.dateTimeString = INVALID_DATE_TIME_STRING;
      this.stringValue = stringValue2 ?? INVALID_DATE_TIME_STRING;
      return;
    }
    const { epochMilliseconds } = dateTime;
    this.value = epochMilliseconds;
    this.booleanValue = booleanValue2 ?? epochMilliseconds !== 0;
    this.numberValue = numberValue ?? epochMilliseconds / DAY_MILLISECONDS;
    const dateTimeString = localDateTimeOrDateString(dateTime);
    this.milliseconds = epochMilliseconds;
    this.dateTimeString = dateTimeString;
    this.stringValue = stringValue2 ?? dateTimeString;
    this.dateString = dateTimeString.replace(/T.*$/, "");
  }
  context;
  dateTime;
  type = "NUMBER";
  nodes = null;
  value;
  booleanValue;
  numberValue;
  stringValue;
  milliseconds;
  dateString;
  dateTimeString;
};

// src/xpath/vendor/xpath/lib/datetime/predicates.ts
var isISODateOrDateTimeLike = (value) => ISO_DATE_OR_DATE_TIME_LIKE_PATTERN.test(value);
var isValidTimeString = (value) => {
  try {
    return Temporal.PlainTime.from(value) != null;
  } catch {
    return false;
  }
};

// src/xpath/vendor/xpath/lib/datetime/coercion.ts
var tryParseDateString = (value) => {
  try {
    const date2 = new Date(value);
    if (Number.isNaN(date2.getTime())) {
      return null;
    }
    return date2;
  } catch {
  }
  return null;
};
var dateTimeFromString = (timeZone, value) => {
  if (!isISODateOrDateTimeLike(value)) {
    return null;
  }
  if (value.endsWith("Z")) {
    return Temporal.ZonedDateTime.from(value.replace(/Z$/, "[UTC]")).withTimeZone(timeZone);
  }
  const offsetMatch = TIMEZONE_OFFSET_PATTERN.exec(value);
  if (offsetMatch != null && !VALID_OFFSET_VALUE.test(offsetMatch[0])) {
    return null;
  }
  if (TIMEZONE_OFFSET_PATTERN.test(value) || !/^\d{4}/.test(value)) {
    const date2 = tryParseDateString(value);
    if (date2 == null) {
      return null;
    }
    const dateTimeString = `${date2.toISOString()}[UTC]`;
    return Temporal.ZonedDateTime.from(dateTimeString).withTimeZone(timeZone);
  }
  return Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone);
};
var toNanoseconds = (milliseconds) => {
  return BigInt(Math.round(milliseconds)) * MILLISECOND_NANOSECONDS;
};
var dateTimeFromNumber = (timeZone, milliseconds) => {
  if (Number.isNaN(milliseconds)) {
    return null;
  }
  return new Temporal.ZonedDateTime(toNanoseconds(milliseconds), timeZone.toString());
};

// src/xpath/vendor/xpath/functions/xforms/datetime.ts
var today = new FunctionImplementation("today", [], (context) => {
  const todayDateTime = now(context.timeZone).with({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0
  });
  return new DateTimeLikeEvaluation(context, todayDateTime);
});
var xfNow = new FunctionImplementation("now", [], (context) => {
  return new DateTimeLikeEvaluation(context, now(context.timeZone));
});
var shortMonths = [
  null,
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
var shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var dateFormatters = {
  /**
   * 4-digit year
   */
  "%Y": (dateTime) => {
    return String(dateTime.year).padStart(4, "0");
  },
  /**
   * 2-digit year
   */
  "%y": (dateTime) => {
    return dateFormatters["%Y"](dateTime).slice(2);
  },
  /**
   * 0-padded month
   */
  "%m": (dateTime) => {
    return String(dateTime.month).padStart(2, "0");
  },
  /**
   * numeric month
   */
  "%n": (dateTime) => {
    return String(dateTime.month);
  },
  /**
   * short text month (Jan, Feb, etc)*
   */
  "%b": (dateTime) => {
    return shortMonths[dateTime.month] ?? "";
  },
  /**
   * 0-padded day of month
   */
  "%d": (dateTime) => {
    return String(dateTime.day).padStart(2, "0");
  },
  /**
   * day of month
   */
  "%e": (dateTime) => {
    return String(dateTime.day);
  },
  /**
   * short text day (Sun, Mon, etc).*
   */
  "%a": (dateTime) => {
    return shortDays[dateTime.dayOfWeek] ?? "";
  }
};
var timeFormatters = {
  /**
   * 0-padded hour (24-hr time)
   */
  "%H": (dateTime) => {
    return String(dateTime.hour).padStart(2, "0");
  },
  /**
   * hour (24-hr time)
   */
  "%h": (dateTime) => {
    return String(dateTime.hour);
  },
  /**
   * 0-padded minute
   */
  "%M": (dateTime) => {
    return String(dateTime.minute).padStart(2, "0");
  },
  /**
   * 0-padded second
   */
  "%S": (dateTime) => {
    return String(dateTime.second).padStart(2, "0");
  },
  /**
   * 0-padded millisecond ticks.*
   */
  "%3": (dateTime) => {
    return String(dateTime.millisecond).padStart(3, "0");
  }
};
var dateTimeFormatters = {
  ...dateFormatters,
  ...timeFormatters
};
var formatter = (formatters) => {
  const identifierPattern = new RegExp(`${Object.keys(formatters).join("|")}`, "g");
  return (format, value) => {
    return format.replaceAll(identifierPattern, (key) => {
      return formatters[key](value);
    });
  };
};
formatter(dateFormatters);
var formatDate = new StringFunction(
  "format-date",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [expression, formatExpression]) => {
    const format = formatExpression.evaluate(context).toString();
    const value = expression.evaluate(context).toString();
    const dateTime = dateTimeFromString(context.timeZone, value);
    if (dateTime == null) {
      return "";
    }
    return dateTimeFormatter(format, dateTime);
  }
);
var dateTimeFormatter = formatter(dateTimeFormatters);
var formatDateTime = new StringFunction(
  "format-date-time",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [expression, formatExpression]) => {
    const format = formatExpression.evaluate(context).toString();
    const value = expression.evaluate(context).toString();
    const dateTime = dateTimeFromString(context.timeZone, value);
    if (dateTime == null) {
      return "";
    }
    return dateTimeFormatter(format, dateTime);
  }
);
var evaluateDateTime = (context, evaluation) => {
  const { timeZone } = context;
  switch (evaluation.type) {
    case "NUMBER": {
      const days = evaluation.toNumber();
      if (Number.isNaN(days)) {
        return null;
      }
      const milliseconds = days * DAY_MILLISECONDS;
      return dateTimeFromNumber(timeZone, milliseconds);
    }
    case "BOOLEAN": {
      throw new Error(
        "Expected a NUMBER or STRING evaluation type for date-time conversion, but received an invalid type."
      );
    }
    default: {
      const stringValue2 = evaluation.toString();
      return dateTimeFromString(timeZone, stringValue2);
    }
  }
};
var UNPADDED_MONTH_DAY_PATTERN = /^(\d{4})-([1-9]|\d{2})-([1-9]|\d{2})(T.*)?$/;
var DATE_OR_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[-+]\d{2}:\d{2})?)?/;
var date = new FunctionImplementation(
  "date",
  [
    // TODO: spec says variadic?!
    { arityType: "required" }
  ],
  (context, [expression]) => {
    const results = expression.evaluate(context);
    switch (results.type) {
      case "BOOLEAN":
        throw new Error("date() does not accept a boolean argument");
      case "NODE":
      case "STRING": {
        const string2 = results.toString();
        if (string2 === "") {
          return new StringEvaluation(context, string2);
        }
        if (!DATE_OR_DATE_TIME_PATTERN.test(string2)) {
          const unpaddedMatches = UNPADDED_MONTH_DAY_PATTERN.exec(string2);
          if (unpaddedMatches == null) {
            throw new Error(`date() received invalid date string: '${string2}'`);
          }
          const [, year, month, day, rest = ""] = unpaddedMatches;
          const paddedString = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${rest}`;
          const dateTime2 = dateTimeFromString(context.timeZone, paddedString);
          return new DateTimeLikeEvaluation(context, dateTime2);
        }
        break;
      }
    }
    const dateTime = evaluateDateTime(context, results);
    if (dateTime == null && results.type !== "NUMBER") {
      throw new Error(`date() received invalid date string: '${results.toString()}'`);
    }
    return new DateTimeLikeEvaluation(context, dateTime);
  }
);
var decimalDateTime = new NumberFunction(
  "decimal-date-time",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const results = expression.evaluate(context);
    const dateTime = evaluateDateTime(context, results);
    if (dateTime == null) {
      return NaN;
    }
    return dateTime.epochMilliseconds / DAY_MILLISECONDS;
  }
);
var decimalTime = new NumberFunction(
  "decimal-time",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const string2 = expression.evaluate(context).toString();
    if (!isValidTimeString(string2)) {
      return NaN;
    }
    if (/^\d{2}:\d{2}(:[0-5]\d)?(\.\d+)?(Z|[-+]\d{2}:\d{2})?$/.test(string2)) {
      const dateTimeString = `1970-01-01T${string2}`;
      const dateTime = dateTimeFromString(context.timeZone, dateTimeString);
      if (dateTime == null) {
        return NaN;
      }
      const { epochMilliseconds } = dateTime.toPlainDateTime().with({
        year: 1970,
        month: 1,
        day: 1
      }).toZonedDateTime("UTC");
      return epochMilliseconds / DAY_MILLISECONDS;
    }
    return NaN;
  }
);

// src/xpath/vendor/xpath/functions/xforms/geo.ts
var geo_exports = {};
__export(geo_exports, {
  area: () => area,
  distance: () => distance,
  geofence: () => geofence
});

// src/xpath/vendor/xpath/error/JRCompatibleGeoValueError.ts
var JRCompatibleGeoValueError = class extends JRCompatibleError {
  constructor(geoFunction) {
    super(`The function '${geoFunction}' received a value that does not represent GPS coordinates`);
  }
};

// src/xpath/vendor/xpath/lib/geo/Geopoint.ts
var isGeopointEncodedSubstringValues = (values) => {
  const { length } = values;
  return length >= 2 && length <= 4 && values.every((value) => {
    return value != null;
  });
};
var DEGREES_MAX = {
  latitude: 90,
  longitude: 180
};
var decodeDegrees = (coordinate, value) => {
  const degrees = Number(value);
  const absolute = Math.abs(degrees);
  const max2 = DEGREES_MAX[coordinate];
  if (absolute > max2) {
    return null;
  }
  return degrees;
};
var decodeGeopointCoordinates = (nodeValue) => {
  const substringValues = nodeValue.split(/\s+/);
  if (!isGeopointEncodedSubstringValues(substringValues)) {
    return null;
  }
  const [latitudeValue, longitudeValue] = substringValues;
  const latitude = decodeDegrees("latitude", latitudeValue);
  const longitude = decodeDegrees("longitude", longitudeValue);
  if (latitude == null || longitude == null) {
    return null;
  }
  return {
    latitude,
    longitude
  };
};
var Geopoint = class {
  static fromNodeValue(nodeValue) {
    const coordinates = decodeGeopointCoordinates(nodeValue);
    if (coordinates == null) {
      return null;
    }
    return new this(coordinates);
  }
  latitude;
  longitude;
  constructor(coordinates) {
    this.latitude = coordinates.latitude;
    this.longitude = coordinates.longitude;
  }
};

// src/xpath/vendor/xpath/lib/geo/EncodeGeoValueStubError.ts
var EncodeGeoValueStubError = class extends Error {
  constructor(valueType) {
    super(`Encoding "${valueType}" values is not implemented here.`);
  }
};

// src/xpath/vendor/xpath/lib/geo/encodeGeoValueStubFactory.ts
var encodeValueStubFactory = (valueType) => {
  return (_) => {
    throw new EncodeGeoValueStubError(valueType);
  };
};

// src/xpath/vendor/xpath/lib/geo/geopointCodec.ts
var geopointCodec = {
  valueType: "geopoint",
  encodeValue: encodeValueStubFactory("geopoint"),
  decodeValue: (value) => {
    return Geopoint.fromNodeValue(value);
  }
};

// src/xpath/vendor/xpath/lib/geo/GeotraceLine.ts
var GeotraceLine = class {
  start;
  end;
  constructor(points) {
    this.start = points.start;
    this.end = points.end;
  }
};

// src/xpath/vendor/xpath/lib/geo/Geotrace.ts
var isGeotracePoints = (geopoints) => {
  return geopoints.length >= 2 && geopoints.every((geopoint) => {
    return geopoint != null;
  });
};
var collectLines = (geopoints) => {
  return geopoints.reduce((acc, geopoint, i) => {
    if (i === 0) {
      return acc;
    }
    const start = geopoints[i - 1];
    const end = geopoint;
    acc.push(
      new GeotraceLine({
        start,
        end
      })
    );
    return acc;
  }, Array());
};
var Geotrace = class {
  constructor(geopoints) {
    this.geopoints = geopoints;
    this.lines = collectLines(geopoints);
  }
  geopoints;
  static fromEncodedGeotrace(encoded) {
    const geopoints = encoded.trim().replace(/(\s*;)+$/, "").split(/\s*;\s*/).map((value) => {
      return geopointCodec.decodeValue(value);
    });
    return this.fromGeopoints(geopoints);
  }
  static fromEncodedValues(values) {
    const [head, ...tail] = values;
    if (head == null) {
      return null;
    }
    if (tail.length === 0) {
      return this.fromEncodedGeotrace(head);
    }
    const geopoints = values.map((value) => {
      return geopointCodec.decodeValue(value);
    });
    return this.fromGeopoints(geopoints);
  }
  static fromGeopoints(geopoints) {
    if (!isGeotracePoints(geopoints)) {
      return null;
    }
    return new this(geopoints);
  }
  lines;
};

// src/xpath/vendor/xpath/functions/xforms/geo.ts
var EARTH_EQUATORIAL_RADIUS_METERS = 6378100;
var PRECISION = 100;
var toRadians = (degrees) => degrees * Math.PI / 180;
var toPrecision = (value, precision) => {
  if (value === 0) {
    return 0;
  }
  return Math.round(value * precision) / precision;
};
var toAbsolutePrecision = (value, precision) => {
  if (value === 0) {
    return 0;
  }
  return Math.abs(toPrecision(value, precision));
};
var geodesicArea = (lines) => {
  const [firstLine, ...rest] = lines;
  const lastLine = rest[rest.length - 1];
  if (firstLine == null || lastLine == null) {
    return 0;
  }
  const { start } = firstLine;
  const { end } = lastLine;
  let shape;
  if (start.latitude === end.latitude && start.longitude === end.longitude) {
    shape = lines;
  } else {
    shape = [...lines, { start: end, end: start }];
  }
  let total = 0;
  for (const { start: start2, end: end2 } of shape) {
    total += toRadians(end2.longitude - start2.longitude) * (2 + Math.sin(toRadians(end2.latitude)) + Math.sin(toRadians(start2.latitude)));
  }
  return total * EARTH_EQUATORIAL_RADIUS_METERS * EARTH_EQUATORIAL_RADIUS_METERS / 2;
};
var evaluateArgumentValues = (context, args) => {
  const evaluations = args.flatMap((arg) => [...arg.evaluate(context)]);
  return evaluations.map((evaluation) => evaluation.toString());
};
var area = new NumberFunction("area", [{ arityType: "required" }], (context, args) => {
  const values = evaluateArgumentValues(context, args);
  const geotrace = Geotrace.fromEncodedValues(values);
  const areaResult = geodesicArea(geotrace?.lines ?? []);
  return toAbsolutePrecision(areaResult, PRECISION);
});
var geodesicDistance = (line) => {
  const { start, end } = line;
  const deltaLambda = toRadians(start.longitude - end.longitude);
  const phi0 = toRadians(start.latitude);
  const phi1 = toRadians(end.latitude);
  return Math.acos(
    Math.sin(phi0) * Math.sin(phi1) + Math.cos(phi0) * Math.cos(phi1) * Math.cos(deltaLambda)
  ) * EARTH_EQUATORIAL_RADIUS_METERS;
};
var sum2 = (values) => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};
var distance = new NumberFunction(
  "distance",
  [{ arityType: "required" }, { arityType: "variadic" }],
  (context, args) => {
    const values = evaluateArgumentValues(context, args);
    const lines = Geotrace.fromEncodedValues(values)?.lines;
    if (lines == null) {
      throw new JRCompatibleGeoValueError("distance");
    }
    const distances = lines.map(geodesicDistance);
    return toAbsolutePrecision(sum2(distances), PRECISION);
  }
);
var calculateIsPointInGPSPolygon = (point, polygon) => {
  const testx = point.longitude;
  const testy = point.latitude;
  let result = false;
  for (let i = 1; i < polygon.geopoints.length; i++) {
    const p1 = polygon.geopoints[i - 1];
    const p2 = polygon.geopoints[i];
    if (!p1 || !p2) {
      return false;
    }
    const { latitude: p1Lat, longitude: p1long } = p1;
    const { latitude: p2Lat, longitude: p2long } = p2;
    if (p2Lat > testy != p1Lat > testy && testx < (p1long - p2long) * (testy - p2Lat) / (p1Lat - p2Lat) + p2long) {
      result = !result;
    }
  }
  return result;
};
var validateGeoshape = (shape) => {
  if (shape.geopoints.length < 2) {
    return false;
  }
  const first = shape.geopoints[0];
  const last2 = shape.geopoints[shape.geopoints.length - 1];
  return first.latitude === last2.latitude && first.longitude === last2.longitude;
};
var geofence = new BooleanFunction(
  "geofence",
  [{ arityType: "required" }, { arityType: "required" }],
  (context, args) => {
    const [point, shape] = evaluateArgumentValues(context, args);
    if (!point || !shape) {
      return false;
    }
    const geopoint = Geopoint.fromNodeValue(point);
    const geoshape = Geotrace.fromEncodedGeotrace(shape);
    if (!geopoint || !geoshape || !validateGeoshape(geoshape)) {
      return false;
    }
    return calculateIsPointInGPSPolygon(geopoint, geoshape);
  }
);

// src/xpath/vendor/xpath/functions/xforms/number.ts
var number_exports2 = {};
__export(number_exports2, {
  abs: () => abs,
  acos: () => acos,
  asin: () => asin,
  atan: () => atan,
  atan2: () => atan2,
  cos: () => cos,
  exp: () => exp,
  exp10: () => exp10,
  int: () => int,
  log: () => log,
  log10: () => log10,
  max: () => max,
  min: () => min,
  number: () => number2,
  pi: () => pi,
  pow: () => pow,
  random: () => random,
  round: () => round2,
  sin: () => sin,
  sqrt: () => sqrt,
  tan: () => tan
});
var abs = mathAlias("abs");
var acos = mathAlias("acos");
var asin = mathAlias("asin");
var atan = mathAlias("atan");
var atan2 = math2Alias("atan2");
var cos = mathAlias("cos");
var exp = mathAlias("exp");
var exp10 = new NumberFunction(
  "exp10",
  [{ arityType: "required", typeHint: "number" }],
  (context, [expression]) => {
    const number3 = expression.evaluate(context).toNumber();
    return 10 ** number3;
  }
);
var int = new NumberFunction(
  "int",
  [{ arityType: "required", typeHint: "number" }],
  (context, [expression]) => {
    const number3 = expression.evaluate(context).toNumber();
    return number3 > 0 ? Math.floor(number3) : Math.ceil(number3);
  }
);
var log = mathAlias("log");
var log10 = mathAlias("log10");
var max = mathNAlias("max");
var min = mathNAlias("min");
var number2 = new FunctionImplementation(
  "number",
  [{ arityType: "optional" }],
  (context, [expression]) => {
    const results = expression?.evaluate(context) ?? context;
    const numberValue = results.toNumber();
    const { type } = results;
    if (type === "NODE" || type === "STRING") {
      const stringValue2 = results.toString();
      const dateTime = dateTimeFromString(context.timeZone, stringValue2);
      if (dateTime != null) {
        return new DateTimeLikeEvaluation(context, dateTime, {
          booleanValue: true,
          stringValue: String(Math.floor(dateTime.epochMilliseconds / DAY_MILLISECONDS))
        });
      }
    }
    if (type === "NUMBER") {
      return results;
    }
    return new NumberEvaluation(context, numberValue);
  }
);
var { PI } = Math;
var pi = new NumberFunction("pi", [], () => PI);
var pow = math2Alias("pow");
var random = new NumberFunction("random", [], Math.random);
var round2 = new NumberFunction(
  "round",
  [
    { arityType: "required", typeHint: "number" },
    { arityType: "optional", typeHint: "number" }
  ],
  (context, [valueExpression, decimalsExpression]) => {
    const value = valueExpression.evaluate(context).toNumber();
    if (Number.isNaN(value)) {
      return value;
    }
    const decimals = decimalsExpression?.evaluate(context).toNumber() ?? 0;
    if (Number.isNaN(decimals)) {
      return NaN;
    }
    if (decimals === 0) {
      return Math.round(value);
    }
    const sign = value < 0 ? -1 : 1;
    const unsigned = Math.abs(value);
    const decimalMultiplier = 10 ** decimals;
    const shifted = unsigned * decimalMultiplier;
    const rounded = Math.round(shifted);
    return rounded / decimalMultiplier * sign;
  }
);
var sin = mathAlias("sin");
var sqrt = mathAlias("sqrt");
var tan = mathAlias("tan");

// src/xpath/vendor/xpath/functions/xforms/select.ts
var select_exports2 = {};
__export(select_exports2, {
  countSelected: () => countSelected,
  selected: () => selected,
  selectedAt: () => selectedAt
});
var countSelected = new NumberFunction(
  "count-selected",
  [{ arityType: "required" }],
  (context, [listExpression]) => {
    const string2 = trimXMLXPathWhitespace(listExpression.evaluate(context).toString());
    if (string2.length === 0) {
      return 0;
    }
    return xmlXPathWhitespaceSeparatedList(string2).length;
  }
);
var selected = new BooleanFunction(
  "selected",
  [{ arityType: "required" }, { arityType: "required" }],
  (context, [listExpression, valueExpression]) => {
    const list = xmlXPathWhitespaceSeparatedList(listExpression.evaluate(context).toString());
    if (list.length === 0) {
      return false;
    }
    const value = trimXMLXPathWhitespace(valueExpression.evaluate(context).toString());
    return list.includes(value);
  }
);
var selectedAt = new StringFunction(
  "selected-at",
  [{ arityType: "required" }, { arityType: "required", typeHint: "number" }],
  (context, [listExpression, indexExpression]) => {
    const list = xmlXPathWhitespaceSeparatedList(listExpression.evaluate(context).toString());
    const index = evaluateInt(context, indexExpression);
    return list[index] ?? "";
  }
);

// src/xpath/vendor/xpath/functions/xforms/string.ts
var string_exports2 = {};
__export(string_exports2, {
  base64Decode: () => base64Decode,
  coalesce: () => coalesce,
  concat: () => concat2,
  digest: () => digest,
  endsWith: () => endsWith,
  join: () => join,
  pulldata: () => pulldata,
  regex: () => regex,
  substr: () => substr,
  uuid: () => uuid
});

// src/xpath/vendor/xpath/error/IncompatibleRuntimeEnvironmentError.ts
var IncompatibleRuntimeEnvironmentError = class extends Error {
};

// src/xpath/vendor/xpath/functions/_shared/string.ts
var toStrings = (context, expressions) => {
  return expressions.flatMap((arg) => {
    const result = arg.evaluate(context);
    switch (result.type) {
      case "NODE":
        return [...result].map((value) => value.toString());
    }
    return result.toString();
  });
};

// src/xpath/vendor/xpath/functions/xforms/string.ts
var decode = (input) => Utf8__default.default.stringify(base64__namespace.parse(input));
var base64Decode = new StringFunction(
  "base64-decode",
  [{ arityType: "required", typeHint: "string" }],
  (context, [base64Expression]) => {
    try {
      return decode(base64Expression.evaluate(context).toString());
    } catch {
      return "";
    }
  }
);
var coalesce = new StringFunction(
  "coalesce",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [aExpression, bExpression]) => {
    const a = aExpression.evaluate(context).toString();
    if (a !== "") {
      return a;
    }
    return bExpression.evaluate(context).toString();
  }
);
var concat2 = new StringFunction(
  "concat",
  [{ arityType: "variadic", typeHint: "string" }],
  (context, args) => {
    if (args.length === 0) {
      return "";
    }
    return args.flatMap((expression) => {
      const results = expression.evaluate(context);
      return Array.from(results).map((result) => result.toString());
    }).join("");
  }
);
var digestHashFunctions = {
  MD5: MD5__default.default,
  "SHA-1": SHA1__default.default,
  "SHA-256": SHA256__default.default,
  "SHA-384": SHA384__default.default,
  "SHA-512": SHA512__default.default
};
var isDigestAlgorithm = (algorithm) => algorithm in digestHashFunctions;
var digestEncodeFunctions = {
  base64: base64__namespace,
  hex: hex__namespace
};
var isDigestEncoding = (encoding) => encoding in digestEncodeFunctions;
var digest = new StringFunction(
  "digest",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "optional", typeHint: "string" }
  ],
  (context, [valueExpression, algorithmExpression, encodingExpression]) => {
    const value = valueExpression.evaluate(context).toString();
    const algorithm = algorithmExpression.evaluate(context).toString();
    if (!isDigestAlgorithm(algorithm)) {
      throw new Error(`Unsupported digest algorithm: '${algorithm}'`);
    }
    const encoding = encodingExpression?.evaluate(context).toString() ?? "base64";
    if (!isDigestEncoding(encoding)) {
      throw new Error(`Unsupported digest encoding: '${encoding}'`);
    }
    const fn2 = digestHashFunctions[algorithm];
    const encode = digestEncodeFunctions[encoding];
    const hash = fn2(value);
    return encode.stringify(hash);
  }
);
var endsWith = new BooleanFunction(
  "ends-with",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [haystackExpression, needleExpression]) => {
    const haystack = haystackExpression.evaluate(context).toString();
    const needle = needleExpression.evaluate(context).toString();
    const result = haystack.endsWith(needle);
    return result;
  }
);
var join = new StringFunction(
  "join",
  [
    { arityType: "required", typeHint: "string" },
    // Deviates from ODK XForms spec, matches ORXE
    { arityType: "variadic" }
  ],
  (context, [glueExpression, ...expressions]) => {
    const glue = glueExpression.evaluate(context).toString();
    const strings = toStrings(context, expressions);
    return strings.join(glue);
  }
);
var pulldata = new StringFunction(
  "pulldata",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [instanceExpression, desiredElementExpression, queryElementExpression, queryExpression]) => {
    const instanceId = instanceExpression.evaluate(context).toString();
    const desiredElement = desiredElementExpression.evaluate(context).toString();
    const queryElement = queryElementExpression.evaluate(context).toString();
    const query = queryExpression.evaluate(context).toString();
    const expr = `instance('${instanceId}')/root/item[${queryElement}='${query}']/${desiredElement}`;
    return context.evaluator.evaluateString(expr);
  }
);
var regex = new BooleanFunction(
  "regex",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [valueExpression, patternExpression]) => {
    const value = valueExpression.evaluate(context).toString();
    const pattern = new RegExp(patternExpression.evaluate(context).toString());
    return pattern.test(value);
  }
);
var substr = new StringFunction(
  "substr",
  [
    { arityType: "required" },
    { arityType: "required", typeHint: "number" },
    { arityType: "optional", typeHint: "number" }
  ],
  (context, [stringExpression, startExpression, endExpression]) => {
    const string2 = stringExpression.evaluate(context).toString();
    const { length } = string2;
    if (length === 0) {
      return "";
    }
    let start = evaluateInt(context, startExpression);
    let end = endExpression != null ? evaluateInt(context, endExpression) : length;
    if (start < 0) {
      start = length + start;
    }
    if (end < 0) {
      end = length + end;
    }
    end = Math.min(Math.max(0, end), length);
    start = Math.min(Math.max(0, start), length);
    return start <= end ? string2.substring(start, end) : "";
  }
);
var didAssertCrypto = false;
var assertCrypto = (crypto) => {
  if (didAssertCrypto) {
    return;
  }
  if (typeof crypto !== "object" || crypto == null) {
    throw new IncompatibleRuntimeEnvironmentError();
  }
  if (typeof crypto.randomUUID !== "function" || crypto.randomUUID.length !== 0) {
    throw new IncompatibleRuntimeEnvironmentError();
  }
  didAssertCrypto = true;
};
var getGlobalCrypto = () => {
  const { crypto } = globalThis;
  assertCrypto(crypto);
  return crypto;
};
var uuid = new StringFunction(
  "uuid",
  [{ arityType: "optional", typeHint: "number" }],
  (context, [lengthExpression]) => {
    const crypto = getGlobalCrypto();
    let result = crypto.randomUUID();
    if (lengthExpression == null) {
      return result;
    }
    const outputLength = lengthExpression.evaluate(context).toNumber();
    if (Number.isNaN(outputLength)) {
      throw new Error("Expected a valid number for the UUID length, but received NaN.");
    }
    while (result.length < outputLength) {
      result = `${result}${crypto.randomUUID()}`;
    }
    return result.slice(0, outputLength);
  }
);

// src/xpath/functions/xforms-indexed-repeat.ts
var assertArgument = (index, arg) => {
  if (arg == null) {
    throw new Error(`Argument ${index + 1} expected`);
  }
};
var evaluateArgumentNodes = (context, arg) => {
  const evaluation = arg.evaluate(context);
  LocationPathEvaluation.assertInstance(context, evaluation);
  return Array.from(evaluation.contextNodes);
};
var compareContainmentDepth = (domProvider, { repeats: a }, { repeats: b }) => {
  for (const repeatA of a) {
    for (const repeatB of b) {
      if (domProvider.isDescendantNode(repeatA, repeatB)) {
        return -1;
      }
      if (domProvider.isDescendantNode(repeatB, repeatA)) {
        return 1;
      }
    }
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  return 0;
};
var indexedRepeat = new NodeSetFunction(
  "indexed-repeat",
  [
    { arityType: "required", typeHint: "node" },
    { arityType: "required", typeHint: "node" },
    { arityType: "required", typeHint: "number" },
    { arityType: "optional", typeHint: "node" },
    { arityType: "optional", typeHint: "number" },
    { arityType: "optional", typeHint: "node" },
    { arityType: "optional", typeHint: "number" },
    { arityType: "variadic", typeHint: "any" }
  ],
  (context, args) => {
    const target = args[0];
    let pairs = [];
    for (let i = 1; i < args.length; i += 2) {
      const repeatsArg = args[i];
      const positionArg = args[i + 1];
      assertArgument(i, repeatsArg);
      assertArgument(i + 1, positionArg);
      const position3 = positionArg.evaluate(context).toNumber();
      if (Number.isNaN(position3)) {
        return [];
      }
      const repeats = evaluateArgumentNodes(context, repeatsArg);
      if (repeats.length === 0) {
        return [];
      }
      pairs.push({ repeats, position: position3 });
    }
    const { domProvider } = context;
    pairs = pairs.sort((pairA, pairB) => compareContainmentDepth(domProvider, pairA, pairB));
    let repeatContextNode;
    for (const [index, pair] of pairs.entries()) {
      const { position: position3 } = pair;
      let { repeats } = pair;
      if (index > 0) {
        repeats = pair.repeats.filter((repeat) => {
          return domProvider.isDescendantNode(repeatContextNode, repeat);
        });
      }
      const positionedRepeat = repeats[position3 - 1];
      if (positionedRepeat == null) {
        return [];
      }
      repeatContextNode = positionedRepeat;
    }
    const targetNodes = evaluateArgumentNodes(context, target);
    return targetNodes.filter((targetNode) => {
      return domProvider.isDescendantNode(repeatContextNode, targetNode);
    });
  }
);

// src/xpath/functions/instance-fn.ts
var instance = new NodeSetFunction(
  "instance",
  [{ arityType: "required", typeHint: "string" }],
  (context, [idExpr]) => {
    const id2 = idExpr.evaluate(context).toString();
    const doc = context.contextDocument;
    const secondaryDoc = doc.secondaryInstances?.get(id2) ?? null;
    return secondaryDoc == null ? [] : [secondaryDoc];
  }
);

// src/xpath/functions/itext-fn.ts
var itext = new StringFunction(
  "itext",
  [{ arityType: "required", typeHint: "string" }],
  (context, [idExpr]) => {
    const id2 = idExpr.evaluate(context).toString();
    const doc = context.contextDocument;
    const resolver = doc.itext;
    return resolver?.resolve(id2) ?? `[${id2}]`;
  }
);

// src/xpath/functions/xforms-once.ts
var once = new StringFunction(
  "once",
  [{ arityType: "required" }],
  (context, [expression]) => {
    const [contextNode] = context.contextNodes;
    if (contextNode == null) {
      throw new Error("No context node available for the once function.");
    }
    const current2 = context.domProvider.getNodeValue(contextNode);
    if (current2 === "") {
      return expression.evaluate(context).toString();
    }
    return current2;
  }
);

// src/xpath/functions/xforms-position.ts
var position2 = new NumberFunction(
  "position",
  [{ arityType: "optional" }],
  (context, [expression]) => {
    if (expression == null) {
      return context.contextPosition();
    }
    const results = expression.evaluate(context);
    if (typeof results.values !== "function") {
      return context.contextPosition();
    }
    const nodeSet = results;
    const [first] = nodeSet.values();
    if (first == null) {
      return 0;
    }
    const node = first.value;
    if (node != null && node.kind === "element" && node.node != null) {
      const mult = node.node.multiplicity;
      if (typeof mult === "number" && mult >= 0) {
        return mult + 1;
      }
    }
    const { domProvider } = context;
    const rawNode = first.value;
    if (domProvider.isQualifiedNamedNode(rawNode)) {
      const nodeName = domProvider.getQualifiedName(rawNode);
      let currentNode = rawNode;
      let result = 0;
      do {
        result += 1;
        const previousNode = domProvider.getPreviousSiblingElement(currentNode);
        if (previousNode == null) break;
        currentNode = previousNode;
      } while (domProvider.getQualifiedName(currentNode) === nodeName);
      return result;
    }
    return context.contextPosition();
  }
);

// src/xpath/functions/xforms-pulldata.ts
var escapeXPathStringLiteral = (value) => value.replace(/'/g, "&apos;");
function nodeValueAsString(node) {
  const value = node.value;
  if (value == null) return null;
  return value.kind === "string" || value.kind === "uncast" ? value.value : value.displayText;
}
var secondaryInstanceIndexCache = /* @__PURE__ */ new WeakMap();
function isFlatItemColumnTree(root) {
  for (const item of root.children) {
    if (item.attributes != null) return false;
    for (const column of item.children) {
      if (column.children.length > 0 || column.attributes != null) return false;
    }
  }
  return true;
}
function getSecondaryInstanceIndex(root) {
  let index = secondaryInstanceIndexCache.get(root);
  if (index == null) {
    index = { isFlat: isFlatItemColumnTree(root), columnIndexes: /* @__PURE__ */ new Map() };
    secondaryInstanceIndexCache.set(root, index);
  }
  return index;
}
function getColumnIndex(root, lookupColumn) {
  const index = getSecondaryInstanceIndex(root);
  if (!index.isFlat) return null;
  let columnIndex = index.columnIndexes.get(lookupColumn);
  if (columnIndex == null) {
    const byLookupValue = /* @__PURE__ */ new Map();
    for (const item of root.children) {
      const column = item.children.find((child) => child.name === lookupColumn);
      const columnValue = column == null ? null : nodeValueAsString(column);
      if (columnValue != null && !byLookupValue.has(columnValue)) {
        byLookupValue.set(columnValue, item);
      }
    }
    columnIndex = byLookupValue;
    index.columnIndexes.set(lookupColumn, columnIndex);
  }
  return columnIndex;
}
var pulldata2 = new StringFunction(
  "pulldata",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [instanceExpression, desiredElementExpression, queryElementExpression, queryExpression]) => {
    const instanceId = instanceExpression.evaluate(context).toString();
    const desiredElement = desiredElementExpression.evaluate(context).toString();
    const queryElement = queryElementExpression.evaluate(context).toString();
    const query = queryExpression.evaluate(context).toString();
    const doc = context.contextDocument;
    const secondaryDoc = doc.secondaryInstances?.get(instanceId) ?? null;
    if (secondaryDoc != null && secondaryDoc.kind === "document") {
      const root = secondaryDoc.tree.root;
      const columnIndex = getColumnIndex(root, queryElement);
      if (columnIndex != null) {
        const item = columnIndex.get(query);
        if (item == null) return "";
        const desiredNode = item.children.find((child) => child.name === desiredElement);
        return desiredNode == null ? "" : nodeValueAsString(desiredNode) ?? "";
      }
    }
    const expr = `instance('${escapeXPathStringLiteral(instanceId)}')/root/item[${queryElement}='${escapeXPathStringLiteral(query)}']/${desiredElement}`;
    const rootNode = context.rootNode;
    return context.evaluator.evaluate(
      expr,
      rootNode,
      null,
      XPATH_EVALUATION_RESULT.STRING_TYPE
    ).stringValue;
  }
);

// src/xpath/vendor/xpath/lib/collections/sort.ts
var MAX_INT_32 = 2147483647;
var SEED_MODULO_OPERAND = MAX_INT_32;
var MIN_STD = 16807;
var UnseededPseudoRandomNumberGenerator = class {
  random() {
    return Math.random();
  }
};
var ParkMillerPRNG = class {
  seed;
  constructor(seed) {
    let initialSeed;
    if (typeof seed === "bigint") {
      initialSeed = Number(BigInt(seed) % BigInt(SEED_MODULO_OPERAND));
    } else {
      initialSeed = seed % SEED_MODULO_OPERAND;
    }
    if (initialSeed <= 0) {
      initialSeed += MAX_INT_32 - 1;
    }
    this.seed = initialSeed;
  }
  random() {
    const { seed: previousSeed } = this;
    const seed = previousSeed * MIN_STD % SEED_MODULO_OPERAND;
    const result = (seed - 1) / (MAX_INT_32 - 1);
    this.seed = seed;
    return result;
  }
};
var JavaRosaPRNG = class extends ParkMillerPRNG {
  // Per issue #49 (https://github.com/getodk/web-forms/issues/49) this is intended to be "bug-or-feature-compatible"
  // with JavaRosa's implementation; org.javarosa.core.model.ItemsetBinding.resolveRandomSeed takes the .longValue() of
  // the double produced by randomSeedPathExpr.eval() — see https://github.com/getodk/javarosa/blob/6ce13527c/src/main/java/org/javarosa/core/model/ItemsetBinding.java#L311:L317 .
  // That results in a 0L when the double is NaN, which happens (for instance) when there
  // is a string that does not look like a number (which is a problem in itself, as any non-numeric
  // looking string will then result in the same seed of 0 — see https://github.com/getodk/javarosa/issues/800).
  // We'll emulate Java's Double -> Long conversion here (for NaN and some other double values)
  // so that we produce the same randomization as JR.
  constructor(seed) {
    let finalSeed;
    if (Number.isNaN(seed)) finalSeed = 0;
    else if (seed === Infinity) finalSeed = 2n ** 63n - 1n;
    else if (seed === -Infinity) finalSeed = -(2n ** 63n);
    else if (typeof seed === "number" && !Number.isInteger(seed)) finalSeed = Math.trunc(seed);
    else finalSeed = seed;
    super(finalSeed);
  }
};
var seededRandomize = (values, seed) => {
  let generator;
  if (seed == null) {
    generator = new UnseededPseudoRandomNumberGenerator();
  } else {
    generator = new JavaRosaPRNG(seed);
  }
  const { length } = values;
  const results = [];
  for (let i = 0; i < length; i += 1) {
    const j = Math.floor(generator.random() * (i + 1));
    if (j !== i) {
      results[i] = results[j];
    }
    results[j] = values[i];
  }
  return results;
};

// src/xpath/functions/xforms-randomize.ts
function toBigIntHash(text) {
  const buffer = new ArrayBuffer(8);
  const dataview = new DataView(buffer);
  SHA256__default.default(text).words.slice(0, 2).forEach(
    (val, ix) => dataview.setInt32(ix * Int32Array.BYTES_PER_ELEMENT, val)
  );
  return dataview.getBigInt64(0);
}
var randomize = new NodeSetFunction(
  "randomize",
  [
    { arityType: "required", typeHint: "node" },
    { arityType: "optional", typeHint: "number" }
  ],
  (context, [expression, seedExpression]) => {
    const results = expression.evaluate(context);
    LocationPathEvaluation.assertInstance(context, results);
    const nodes = results.values().map(({ value }) => value);
    if (seedExpression === void 0) {
      return seededRandomize(nodes);
    }
    const seedValue = seedExpression.evaluate(context);
    const asNumber = seedValue.toNumber();
    let finalSeed;
    if (Number.isNaN(asNumber)) {
      const seedString = seedValue.toString();
      if (seedString === "") {
        finalSeed = 0;
      } else {
        finalSeed = toBigIntHash(seedString);
      }
    } else {
      finalSeed = asNumber;
    }
    return seededRandomize(nodes, finalSeed);
  }
);

// src/xpath/functions/xforms-regex.ts
function anchorPattern(raw) {
  return `^(?:${raw})$`;
}
var regex2 = new BooleanFunction(
  "regex",
  [
    { arityType: "required", typeHint: "string" },
    { arityType: "required", typeHint: "string" }
  ],
  (context, [valueExpression, patternExpression]) => {
    const value = valueExpression.evaluate(context).toString();
    const raw = patternExpression.evaluate(context).toString();
    return new RegExp(anchorPattern(raw)).test(value);
  }
);

// src/xpath/functions/xforms-uuid.ts
function defaultUuidV4() {
  const nibbles = [];
  for (let i = 0; i < 32; i++) {
    nibbles.push(Math.floor(Math.random() * 16).toString(16));
  }
  nibbles[12] = "4";
  nibbles[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  const h = nibbles.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
var activeUuidGenerator = defaultUuidV4;
var uuid2 = new StringFunction(
  "uuid",
  [{ arityType: "optional", typeHint: "number" }],
  (context, [lengthExpression]) => {
    let result = activeUuidGenerator();
    if (lengthExpression == null) {
      return result;
    }
    const outputLength = lengthExpression.evaluate(context).toNumber();
    if (Number.isNaN(outputLength)) {
      throw new Error(
        "Expected a valid number for the UUID length, but received NaN."
      );
    }
    while (result.length < outputLength) {
      result += activeUuidGenerator();
    }
    return result.slice(0, outputLength);
  }
);

// src/xpath/functions/index.ts
var jr = new FunctionLibrary(JAVAROSA_NAMESPACE_URI, [
  ...Object.values(select_exports),
  itext
]);
var {
  uuid: _vendorUuid,
  // excluded — replaced by native Hermes-safe shim (6c)
  regex: _vendorRegex,
  // excluded — replaced by native full-match shim (6d)
  pulldata: _vendorPulldata,
  // excluded — replaced by native shim (6e); vendor calls
  // context.evaluator.evaluateString() without a contextNode,
  // which throws since the InstanceEvaluator singleton has no rootNode.
  ...xfStringWithoutExcluded
} = string_exports2;
var xf = new FunctionLibrary(XFORMS_NAMESPACE_URI, [
  ...Object.values(boolean_exports2),
  ...Object.values(datetime_exports),
  ...Object.values(geo_exports),
  ...Object.values(number_exports2),
  ...Object.values(select_exports2),
  ...Object.values(xfStringWithoutExcluded),
  indexedRepeat,
  instance,
  position2,
  // native shim — extends fn.position() with JR extension: position(nodeset) (7b)
  once,
  // native shim — vendor node-set.ts excluded (circular dep, 6b)
  pulldata2,
  // native shim — vendor throws (no rootNode on InstanceEvaluator singleton, 6e)
  randomize,
  // native shim — vendor node-set.ts excluded (circular dep, 6b)
  regex2,
  // native full-match shim — vendor partial-match replaced (6d)
  uuid2
  // native Hermes-safe pure-JS v4 replacement for xfString.uuid (6c)
]);
var defaultFunctions = new FunctionLibraryCollection([fn, jr, xf], {
  defaultNamespaceURIs: [XFORMS_NAMESPACE_URI, FN_NAMESPACE_URI]
});

// src/platform/PlatformConfig.ts
var DEFAULT_TIME_ZONE_ID = "UTC";
var _timeZoneId = DEFAULT_TIME_ZONE_ID;
function getPlatformTimeZoneId() {
  return _timeZoneId;
}

// src/xpath/vendor/xpath/adapter/interface/XPathNode.ts
var XPathNodeKindKey = /* @__PURE__ */ Symbol("XPathNodeKindKey");

// src/xpath/adapter/instance/InstanceXPathNode.ts
function makeWrapperCache() {
  return /* @__PURE__ */ new WeakMap();
}

// src/xpath/adapter/instance/answerValueToXPathString.ts
function answerValueToXPathString(value) {
  if (value === null) {
    return "";
  }
  switch (value.kind) {
    case "string":
    case "uncast":
    case "unsupported":
    case "binary":
      return value.value;
    case "int":
    case "long":
    case "decimal":
      return String(value.value);
    case "boolean":
      return value.value ? "true" : "false";
    case "date":
    case "time":
    case "dateTime":
      return value.displayText;
    case "selectOne":
      return value.value;
    case "selectMulti":
      return value.value.join(" ");
    case "geopoint": {
      const { lat, lon, alt, acc } = value.value;
      return `${lat} ${lon} ${alt} ${acc}`;
    }
    case "geoshape":
    case "geotrace":
      return value.value.map(({ lat, lon, alt, acc }) => `${lat} ${lon} ${alt} ${acc}`).join(";");
  }
}

// src/xpath/adapter/instance/InstanceNodeXPathAdapter.ts
var activeRelevanceCheck = null;
function setActiveRelevanceCheck(check) {
  activeRelevanceCheck = check;
}
var activeChoiceNameResolver = null;
function getActiveChoiceNameResolver() {
  return activeChoiceNameResolver;
}
function setActiveChoiceNameResolver(resolver) {
  activeChoiceNameResolver = resolver;
}
var documentCaches = /* @__PURE__ */ new WeakMap();
function makeInstanceDocumentNode(tree, opts) {
  const doc = {
    [XPathNodeKindKey]: "document",
    kind: "document",
    tree,
    node: null,
    ...opts?.secondaryInstances !== void 0 && { secondaryInstances: opts.secondaryInstances },
    ...opts?.itext !== void 0 && { itext: opts.itext }
  };
  documentCaches.set(doc, makeWrapperCache());
  return doc;
}
function wrapInstanceNode(node, doc) {
  const cache = documentCaches.get(doc);
  if (cache === void 0) {
    throw new Error("Document node has no wrapper cache \u2014 was it created via makeInstanceDocumentNode?");
  }
  const existing = cache.get(node);
  if (existing !== void 0) {
    return existing;
  }
  const wrapper = {
    [XPathNodeKindKey]: "element",
    kind: "element",
    node,
    doc,
    getChoiceName(value) {
      return activeChoiceNameResolver?.(wrapper, value) ?? null;
    }
  };
  cache.set(node, wrapper);
  return wrapper;
}
function getDoc(n) {
  switch (n.kind) {
    case "document":
      return n;
    case "element":
      return n.doc;
    case "attribute":
      return n.owner.doc;
    case "text":
      return n.owner.doc;
  }
}
function getParentElement(n) {
  const parent = n.node.parent;
  if (parent === null) return null;
  return wrapInstanceNode(parent, n.doc);
}
function syntheticTextChild(el, value) {
  return {
    [XPathNodeKindKey]: "text",
    kind: "text",
    owner: el,
    value
  };
}
function getElementStringValue(el) {
  if (activeRelevanceCheck !== null && !activeRelevanceCheck(el)) {
    return "";
  }
  const realChildren = el.node.children.filter(
    (c) => c.multiplicity !== INDEX_TEMPLATE
  );
  if (realChildren.length === 0) {
    return answerValueToXPathString(el.node.value);
  }
  return realChildren.map((child) => getElementStringValue(wrapInstanceNode(child, el.doc))).join("");
}
function pathIndexVector(n) {
  switch (n.kind) {
    case "document":
      return [];
    case "element": {
      const indices = [];
      let current2 = n;
      while (current2 !== null) {
        const parent = getParentElement(current2);
        if (parent === null) {
          indices.unshift(0);
        } else {
          const realChildren = parent.node.children.filter(
            (c) => c.multiplicity !== INDEX_TEMPLATE
          );
          const idx = realChildren.indexOf(current2.node);
          indices.unshift(idx < 0 ? 0 : idx);
        }
        current2 = parent;
      }
      return indices;
    }
    case "attribute": {
      const ownerVec = pathIndexVector(n.owner);
      const attrKeys = attributeNames(n.owner.node);
      const attrIdx = attrKeys.indexOf(n.name);
      return [...ownerVec, 1e6 + (attrIdx < 0 ? 0 : attrIdx)];
    }
    case "text": {
      const ownerVec = pathIndexVector(n.owner);
      return [...ownerVec, 2e6];
    }
  }
}
function compareVectors(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}
var instanceNodeXPathAdapter = {
  // -------------------------------------------------------------------------
  // XPathNodeKindAdapter
  // -------------------------------------------------------------------------
  isXPathNode(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    const kind = v["kind"];
    return kind === "document" || kind === "element" || kind === "attribute" || kind === "text";
  },
  getNodeKind(node) {
    return node.kind;
  },
  // -------------------------------------------------------------------------
  // XPathNameAdapter
  // -------------------------------------------------------------------------
  getNamespaceURI(node) {
    return null;
  },
  getQualifiedName(node) {
    const n = node;
    if (n.kind === "element") return n.node.name;
    if (n.kind === "attribute") return n.name;
    return "";
  },
  getLocalName(node) {
    const n = node;
    if (n.kind === "element") {
      const name2 = n.node.name;
      const colon = name2.indexOf(":");
      return colon >= 0 ? name2.slice(colon + 1) : name2;
    }
    if (n.kind === "attribute") {
      const colon = n.name.indexOf(":");
      return colon >= 0 ? n.name.slice(colon + 1) : n.name;
    }
    return "";
  },
  getProcessingInstructionName(_node) {
    throw new Error("InstanceNodeXPathAdapter: processing instructions are not supported");
  },
  resolveNamespaceURI(_node, _prefix) {
    return null;
  },
  // -------------------------------------------------------------------------
  // XPathValueAdapter
  // -------------------------------------------------------------------------
  getNodeValue(node) {
    if (activeRelevanceCheck !== null && node.kind === "element") {
      if (!activeRelevanceCheck(node)) {
        return "";
      }
    }
    switch (node.kind) {
      case "document": {
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return getElementStringValue(rootWrapper);
      }
      case "element":
        return getElementStringValue(node);
      case "attribute":
        return node.value;
      case "text":
        return node.value;
    }
  },
  // -------------------------------------------------------------------------
  // XPathTraversalAdapter
  // -------------------------------------------------------------------------
  getContainingDocument(node) {
    return getDoc(node);
  },
  getNamespaceDeclarations(_node) {
    return [];
  },
  getAttributes(node) {
    if (node.kind !== "element") return [];
    const result = [];
    for (const [name2, value] of node.node.attributes ?? []) {
      result.push({
        [XPathNodeKindKey]: "attribute",
        kind: "attribute",
        owner: node,
        name: name2,
        value
      });
    }
    return result;
  },
  getParentNode(node) {
    switch (node.kind) {
      case "document":
        return null;
      case "element": {
        if (node.node.parent === null) {
          return node.doc;
        }
        return wrapInstanceNode(node.node.parent, node.doc);
      }
      case "attribute":
        return node.owner;
      case "text":
        return node.owner;
    }
  },
  getChildNodes(node) {
    switch (node.kind) {
      case "document": {
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return [rootWrapper];
      }
      case "element": {
        const realChildren = node.node.children.filter(
          (c) => c.multiplicity !== INDEX_TEMPLATE
        );
        const result = [];
        if (realChildren.length === 0) {
          const strVal = answerValueToXPathString(node.node.value);
          if (strVal !== "") {
            result.push(syntheticTextChild(node, strVal));
          }
        } else {
          for (const child of realChildren) {
            result.push(
              wrapInstanceNode(child, node.doc)
            );
          }
        }
        return result;
      }
      case "attribute":
      case "text":
        return [];
    }
  },
  getChildElements(node) {
    switch (node.kind) {
      case "document": {
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return [rootWrapper];
      }
      case "element": {
        const realChildren = node.node.children.filter(
          (c) => c.multiplicity !== INDEX_TEMPLATE
        );
        return realChildren.map(
          (c) => wrapInstanceNode(c, node.doc)
        );
      }
      case "attribute":
      case "text":
        return [];
    }
  },
  getPreviousSiblingNode(node) {
    if (node.kind !== "element") return null;
    const parent = node.node.parent;
    if (parent === null) return null;
    const realChildren = parent.children.filter(
      (c) => c.multiplicity !== INDEX_TEMPLATE
    );
    const idx = realChildren.indexOf(node.node);
    if (idx <= 0) return null;
    const prev = realChildren[idx - 1];
    if (prev === void 0) return null;
    return wrapInstanceNode(prev, node.doc);
  },
  getPreviousSiblingElement(node) {
    return instanceNodeXPathAdapter.getPreviousSiblingNode(node);
  },
  getNextSiblingNode(node) {
    if (node.kind !== "element") return null;
    const parent = node.node.parent;
    if (parent === null) return null;
    const realChildren = parent.children.filter(
      (c) => c.multiplicity !== INDEX_TEMPLATE
    );
    const idx = realChildren.indexOf(node.node);
    if (idx < 0 || idx >= realChildren.length - 1) return null;
    const next = realChildren[idx + 1];
    if (next === void 0) return null;
    return wrapInstanceNode(next, node.doc);
  },
  getNextSiblingElement(node) {
    return instanceNodeXPathAdapter.getNextSiblingNode(node);
  },
  compareDocumentOrder(a, b) {
    if (a === b) return 0;
    return compareVectors(pathIndexVector(a), pathIndexVector(b));
  },
  isDescendantNode(ancestor, node) {
    if (ancestor.kind === "attribute" || ancestor.kind === "text") return false;
    let current2 = instanceNodeXPathAdapter.getParentNode(node);
    while (current2 !== null) {
      if (current2 === ancestor) return true;
      current2 = instanceNodeXPathAdapter.getParentNode(current2);
    }
    return false;
  }
};

// src/xpath/evaluator/InstanceEvaluator.ts
var sharedParser = new PureJSExpressionParser();
var _instanceEvaluator = null;
function getInstanceEvaluatorInstance() {
  if (_instanceEvaluator === null) {
    _instanceEvaluator = new Evaluator({
      domAdapter: instanceNodeXPathAdapter,
      parser: sharedParser,
      functions: defaultFunctions,
      timeZoneId: getPlatformTimeZoneId()
    });
  }
  return _instanceEvaluator;
}
var instanceEvaluator = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      return Reflect.get(getInstanceEvaluatorInstance(), prop, receiver);
    }
  }
);

// src/xpath/evaluator/XPathVariableValue.ts
function assertXPathVariableValue(value, name2) {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return;
  throw new TypeError(
    `Unsupported XPath variable value for $${name2}: node-set/array/object bindings are not supported (primitives only). Node-set-valued variables are out of scope for this change.`
  );
}

// src/xpath/seam/XPathSeam.ts
function toActiveVariableMap(variables) {
  if (variables === void 0) return EMPTY_VARIABLES;
  for (const [name2, value] of variables) {
    assertXPathVariableValue(value, name2);
  }
  return variables;
}
var EMPTY_VARIABLES = /* @__PURE__ */ new Map();
function compileInstanceXPath(expr) {
  return {
    source: expr,
    evaluateTyped(context) {
      const variables = toActiveVariableMap(context?.variables);
      const contextNode = context?.contextNode;
      if (contextNode === void 0) {
        const result2 = setActiveVariables(
          variables,
          () => instanceEvaluator.evaluate(
            expr,
            // Use a minimal stub: we need some node to pass; create a simple doc
            // by evaluating with the xmldom evaluator's context mechanism.
            // For constant expressions (no node access) the context node is irrelevant.
            // We re-use the same trick as the xmldom path: pass contextNode as undefined
            // will fail type-check, so we fall back to an exception for now —
            // callers SHOULD provide a context.
            null,
            null,
            XPATH_EVALUATION_RESULT.ANY_TYPE
          )
        );
        return decodeInstanceResult(result2);
      }
      const result = setActiveVariables(
        variables,
        () => instanceEvaluator.evaluate(
          expr,
          contextNode,
          null,
          XPATH_EVALUATION_RESULT.ANY_TYPE
        )
      );
      return decodeInstanceResult(result);
    },
    evaluate(context) {
      const typed = this.evaluateTyped(context);
      switch (typed.type) {
        case "NUMBER":
          return typed.value;
        case "STRING":
          return typed.value;
        case "BOOLEAN":
          return typed.value;
        case "NODESET":
          return typed.nodes;
      }
    }
  };
}
function evaluateInstanceExpr(expr, ctxNode, resultType) {
  return setActiveVariables(
    EMPTY_VARIABLES,
    () => instanceEvaluator.evaluate(expr, ctxNode, null, resultType)
  );
}
function decodeInstanceResult(result) {
  switch (result.resultType) {
    case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
      return { type: "BOOLEAN", value: result.booleanValue };
    case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
      return { type: "NUMBER", value: result.numberValue };
    case XPATH_EVALUATION_RESULT.STRING_TYPE:
      return { type: "STRING", value: result.stringValue };
    default: {
      const nodes = [];
      let node = result.iterateNext();
      while (node !== null) {
        nodes.push(node);
        node = result.iterateNext();
      }
      return { type: "NODESET", nodes };
    }
  }
}

// src/eval/getTriggers.ts
function getTriggers(root, contextRef, originalContextRef) {
  const collected = /* @__PURE__ */ new Set();
  const results = [];
  function add(ref) {
    const key = refToString(genericize(ref));
    if (!collected.has(key)) {
      collected.add(key);
      results.push(genericize(ref));
    }
  }
  function walk(node) {
    switch (node.type) {
      // -----------------------------------------------------------------------
      // Wrappers — just recurse into children
      // -----------------------------------------------------------------------
      case "xpath":
      case "expr":
        for (const child of node.children) walk(child);
        break;
      // -----------------------------------------------------------------------
      // Absolute location path: /a/b/c or //foo
      // Children: [absolute_root_location_path, step, step, ...]
      //       or: [abbreviated_absolute_location_path]
      // -----------------------------------------------------------------------
      case "absolute_location_path": {
        const ref = decodeAbsoluteLocationPath(node);
        if (ref !== null) add(ref);
        walkAbsolutePathPredicates(node, contextRef, originalContextRef, add);
        break;
      }
      // -----------------------------------------------------------------------
      // Relative location path: a/b/c or ./foo or ../foo
      // Children: [step, step, ...] with optional '//' literal siblings
      // -----------------------------------------------------------------------
      case "relative_location_path": {
        const ref = decodeRelativeLocationPath(node, contextRef, originalContextRef);
        if (ref !== null) add(ref);
        walkAbsolutePathPredicates(node, contextRef, originalContextRef, add);
        break;
      }
      // -----------------------------------------------------------------------
      // filter_path_expr: FilterExpr / RelativeLocationPath
      // Children: [filter_path_expr (head), step, step, ...]
      // The head is a filter expression; recurse into it for its own triggers.
      // The trailing steps (if any) form a relative path on top of the head result —
      // we recurse into them as individual expressions too.
      // -----------------------------------------------------------------------
      case "filter_path_expr": {
        for (const child of node.children) {
          if (child.type === "filter_expr") {
            walk(child);
          } else if (child.type === "filter_path_expr") {
            walk(child);
          } else if (child.type === "step") {
            walkStepPredicates(child, contextRef, originalContextRef, walk);
          }
        }
        break;
      }
      // -----------------------------------------------------------------------
      // filter_expr: wraps function_call, string_literal, number, expr
      // -----------------------------------------------------------------------
      case "filter_expr":
        for (const child of node.children) walk(child);
        break;
      // -----------------------------------------------------------------------
      // Binary expressions — recurse into both operands
      // -----------------------------------------------------------------------
      case "addition_expr":
      case "subtraction_expr":
      case "multiplication_expr":
      case "division_expr":
      case "modulo_expr":
      case "and_expr":
      case "or_expr":
      case "eq_expr":
      case "ne_expr":
      case "lt_expr":
      case "lte_expr":
      case "gt_expr":
      case "gte_expr":
      case "union_expr":
        for (const child of node.children) walk(child);
        break;
      // -----------------------------------------------------------------------
      // Unary expression — recurse into the single operand
      // -----------------------------------------------------------------------
      case "unary_expr":
        for (const child of node.children) walk(child);
        break;
      // -----------------------------------------------------------------------
      // function_call — recurse into argument children.
      // Special: current() → add originalContextRef as a trigger.
      // -----------------------------------------------------------------------
      case "function_call": {
        const fnNameNode = node.children.find((c) => c.type === "function_name");
        const fnName = fnNameNode?.text ?? "";
        if (fnName === "current") {
          add(originalContextRef);
        } else {
          for (const child of node.children) {
            if (child.type === "argument") {
              for (const argChild of child.children) walk(argChild);
            }
          }
        }
        break;
      }
      // -----------------------------------------------------------------------
      // Literals and variable references — no path triggers
      // -----------------------------------------------------------------------
      case "number":
      case "string_literal":
      case "variable_reference":
        break;
      // -----------------------------------------------------------------------
      // Steps that appear at the top level (rare — bare '.' or '..')
      // -----------------------------------------------------------------------
      case "step": {
        const ref = decodeStepAsRelative(node, contextRef);
        if (ref !== null) add(ref);
        break;
      }
      // -----------------------------------------------------------------------
      // Default: recurse into any unrecognized node's children
      // -----------------------------------------------------------------------
      default:
        for (const child of node.children) walk(child);
        break;
    }
  }
  walk(root);
  return results;
}
function decodeAbsoluteLocationPath(node, contextRef, originalContextRef) {
  const firstChild = node.children[0];
  if (firstChild?.type === "abbreviated_absolute_location_path") {
    return decodeAbbreviatedAbsolutePath(firstChild);
  }
  let ref = rootRef();
  for (const child of node.children) {
    if (child.type === "absolute_root_location_path") {
      continue;
    }
    if (child.type === "step") {
      const updated = applyStepToRef(child, ref);
      if (updated === null) return null;
      ref = updated;
    }
  }
  return ref;
}
function decodeAbbreviatedAbsolutePath(node, contextRef, originalContextRef) {
  let ref = rootRef();
  let seenStep = false;
  for (const child of node.children) {
    if (child.type === "//" || child.text === "//") continue;
    if (child.type === "step") {
      const updated = applyStepToRef(child, ref);
      if (updated !== null) {
        ref = updated;
        seenStep = true;
      }
    }
  }
  return seenStep ? ref : null;
}
function decodeRelativeLocationPath(node, contextRef, originalContextRef) {
  const firstStep = node.children.find((c) => c.type === "step");
  const isOrigCtx = firstStep !== void 0 && isAbbreviatedSelf(firstStep);
  let relative = buildRelativeRef(node.children, contextRef, originalContextRef);
  if (relative === null) return null;
  if (isOrigCtx) {
    return genericize(relative);
  }
  return genericize(relative);
}
function decodeStepAsRelative(node, contextRef, originalContextRef) {
  return applyStepToRef(node, contextRef);
}
function applyStepToRef(step, current2, contextRef, originalContextRef) {
  const firstChild = step.children[0];
  if (firstChild === void 0) return null;
  switch (firstChild.type) {
    case "abbreviated_step": {
      const inner = firstChild.children[0];
      if (inner?.type === "self") {
        return current2;
      }
      if (inner?.type === "parent") {
        if (current2.levels.length === 0) return null;
        return parentOf(current2);
      }
      return null;
    }
    case "node_test": {
      const name2 = extractNameFromNodeTest(firstChild);
      if (name2 === null) return null;
      return extendRef(current2, name2, INDEX_UNBOUND);
    }
    case "abbreviated_axis_test": {
      return current2;
    }
    case "axis_test": {
      const axisName = firstChild.children.find((c) => c.type === "axis_name")?.text ?? "";
      const nodeTestChild = firstChild.children.find(
        (c) => c.type === "node_test" || c.type === "node_type_test" || c.type === "unprefixed_name"
      );
      const name2 = nodeTestChild ? extractNameFromNodeTest(nodeTestChild) : null;
      switch (axisName) {
        case "self":
          return current2;
        case "parent":
          return current2.levels.length > 0 ? parentOf(current2) : null;
        case "child":
          if (name2 === null) return current2;
          return extendRef(current2, name2, INDEX_UNBOUND);
        default:
          if (name2 !== null) return extendRef(current2, name2, INDEX_UNBOUND);
          return null;
      }
    }
    default:
      return null;
  }
}
function buildRelativeRef(children, contextRef, originalContextRef) {
  const steps = children.filter((c) => c.type === "step");
  if (steps.length === 0) return null;
  const firstStep = steps[0];
  const firstIsOrigCtx = isAbbreviatedSelf(firstStep);
  let current2 = firstIsOrigCtx ? originalContextRef : contextRef;
  for (const step of steps) {
    const updated = applyStepToRef(step, current2);
    if (updated === null) return null;
    current2 = updated;
  }
  return current2;
}
function walkStepPredicates(step, contextRef, originalContextRef, walker) {
  for (const child of step.children) {
    if (child.type === "predicate") {
      for (const inner of child.children) {
        walker(inner);
      }
    }
  }
}
function walkAbsolutePathPredicates(node, contextRef, originalContextRef, add) {
  function walkNode(n) {
    if (n.type === "predicate") {
      for (const child of n.children) {
        const innerTriggers = getTriggers(child, contextRef, originalContextRef);
        for (const t of innerTriggers) add(t);
      }
    } else {
      for (const child of n.children) walkNode(child);
    }
  }
  for (const child of node.children) walkNode(child);
}
function extractNameFromNodeTest(node) {
  if (node.type === "unprefixed_name") return node.text;
  if (node.type === "prefixed_name") {
    return node.text;
  }
  if (node.type === "node_test") {
    const inner = node.children[0];
    if (!inner) return null;
    if (inner.type === "node_type_test") return null;
    return extractNameFromNodeTest(inner);
  }
  if (node.type === "unprefixed_wildcard_name_test") return null;
  if (node.type === "prefixed_wildcard_name_test") return null;
  return null;
}
function isAbbreviatedSelf(step) {
  const firstChild = step.children[0];
  if (firstChild?.type !== "abbreviated_step") return false;
  const inner = firstChild.children[0];
  return inner?.type === "self";
}

// src/eval/Triggerable.ts
function isCascadingToChildren(t) {
  return t.kind === "condition" && t.action === "relevant";
}
function makeRecalculate(expr, targets, triggers, contextRef, originalContextRef) {
  return {
    kind: "recalculate",
    expr,
    targets,
    triggers,
    contextRef,
    originalContextRef
  };
}
function makeCondition(expr, targets, triggers, contextRef, originalContextRef, action) {
  return {
    kind: "condition",
    action,
    expr,
    targets,
    triggers,
    contextRef,
    originalContextRef
  };
}

// src/parse/bindProcessor.ts
function dataTypeFromBindType(typeAttr, controlHint) {
  if (typeAttr !== null && typeAttr !== "") {
    const direct = dataTypeFromXsdName(typeAttr);
    if (direct !== "unsupported") return direct;
    const withPrefix = dataTypeFromXsdName(`xsd:${typeAttr}`);
    return withPrefix;
  }
  return "string";
}
function bindProcessor(binds) {
  const result = /* @__PURE__ */ new Map();
  for (const el of binds) {
    const nodeset = el.getAttribute("nodeset") ?? el.getAttribute("ref") ?? null;
    if (nodeset === null) continue;
    const typeAttr = el.getAttribute("type") ?? null;
    const dataType = dataTypeFromBindType(typeAttr);
    const binding = {
      nodeset,
      ref: parseAbsoluteRef(nodeset),
      dataType,
      relevant: el.getAttribute("relevant") ?? null,
      required: el.getAttribute("required") ?? null,
      readonly_: el.getAttribute("readonly") ?? null,
      calculate: el.getAttribute("calculate") ?? null,
      constraint: el.getAttribute("constraint") ?? null,
      constraintMsg: el.getAttribute("jr:constraintMsg") ?? el.getAttribute("constraintMsg") ?? null,
      // T-VAL-1: Read jr:preload first; fall back to bare 'preload' (localName)
      // in case a DOMParser strips the namespace prefix.
      preload: el.getAttribute("jr:preload") ?? el.getAttribute("preload") ?? null,
      preloadParams: el.getAttribute("jr:preloadParams") ?? el.getAttribute("preloadParams") ?? null
    };
    result.set(nodeset, binding);
  }
  return result;
}
var sharedParser2 = new PureJSExpressionParser();
function compileBindings(binds) {
  const result = /* @__PURE__ */ new Map();
  for (const el of binds) {
    const nodeset = el.getAttribute("nodeset") ?? el.getAttribute("ref") ?? null;
    if (nodeset === null) continue;
    const typeAttr = el.getAttribute("type") ?? null;
    const dataType = dataTypeFromBindType(typeAttr);
    const ref = parseAbsoluteRef(nodeset);
    const contextRef = ref;
    const originalContextRef = ref;
    const compiledBindings = [];
    const calculate = el.getAttribute("calculate");
    if (calculate !== null) {
      const cb = compileBinding(calculate, "recalculate", void 0, contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }
    const relevant = el.getAttribute("relevant");
    if (relevant !== null) {
      const cb = compileBinding(relevant, "condition", "relevant", contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }
    const required = el.getAttribute("required");
    if (required !== null) {
      const cb = compileBinding(required, "condition", "required", contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }
    const readonly_ = el.getAttribute("readonly");
    if (readonly_ !== null) {
      const cb = compileBinding(readonly_, "condition", "readonly", contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }
    const constraint = el.getAttribute("constraint");
    if (constraint !== null) {
      const cb = compileBinding(constraint, "condition", "constraint", contextRef, originalContextRef);
      if (cb !== null) compiledBindings.push(cb);
    }
    result.set(nodeset, {
      nodeset,
      ref,
      dataType,
      compiledBindings
    });
  }
  return result;
}
function compileBinding(exprStr, kind, action, contextRef, originalContextRef) {
  let expr;
  try {
    expr = compileInstanceXPath(exprStr);
  } catch {
    return null;
  }
  const parsed = sharedParser2.parse(exprStr).rootNode;
  const triggers = getTriggers(parsed, contextRef, originalContextRef);
  const targets = [contextRef];
  if (kind === "recalculate") {
    return { kind: "recalculate", expr, triggers, contextRef, originalContextRef, targets };
  }
  return {
    kind: "condition",
    action,
    expr,
    triggers,
    contextRef,
    originalContextRef,
    targets
  };
}

// src/eval/TriggerableDag.ts
function finalizeDag(allTriggerables, triggerablesPerTrigger, tree) {
  const immediateCascades = /* @__PURE__ */ new Map();
  const edges = getDagEdges(allTriggerables, triggerablesPerTrigger, immediateCascades, tree);
  const triggerablesDAG = buildDag(allTriggerables, edges);
  const relevancePerRepeat = buildRelevancePerRepeat(triggerablesDAG, tree);
  const triggerableIndex = /* @__PURE__ */ new Map();
  triggerablesDAG.forEach((t, i) => triggerableIndex.set(t, i));
  return {
    allTriggerables,
    triggerablesDAG,
    triggerablesPerTrigger,
    immediateCascades,
    relevancePerRepeat,
    triggerableIndex
  };
}
function addTriggerable(triggerable, allTriggerables, triggerablesPerTrigger) {
  const existing = findTriggerable(triggerable, allTriggerables);
  if (existing !== null) {
    intersectContextWith(existing, triggerable);
    return existing;
  }
  allTriggerables.add(triggerable);
  for (const trigger of triggerable.triggers) {
    const key = refToString(genericize(trigger));
    let set = triggerablesPerTrigger.get(key);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      triggerablesPerTrigger.set(key, set);
    }
    set.add(triggerable);
  }
  return triggerable;
}
function intersectContextWith(existing, incoming) {
  const a = existing.contextRef;
  const b = incoming.contextRef;
  const minLen = Math.min(a.levels.length, b.levels.length);
  let commonLen = 0;
  for (let i = 0; i < minLen; i++) {
    if (a.levels[i].name === b.levels[i].name) {
      commonLen = i + 1;
    } else {
      break;
    }
  }
  const intersectedLevels = a.levels.slice(0, commonLen);
  existing.contextRef = {
    refLevel: a.refLevel,
    contextType: a.contextType,
    instanceName: a.instanceName,
    levels: Object.freeze(intersectedLevels)
  };
}
function getDagEdges(allTriggerables, triggerablesPerTrigger, immediateCascades, tree) {
  const edges = [];
  for (const source of allTriggerables) {
    const targets = getDependantTriggerables(source, triggerablesPerTrigger, tree);
    if (targets.has(source)) {
      throwCycleDetected(allTriggerables);
    }
    for (const target of targets) {
      edges.push([source, target]);
    }
    immediateCascades.set(source, targets);
  }
  return edges;
}
function getDependantTriggerables(source, triggerablesPerTrigger, tree) {
  const allDependantTriggerables = /* @__PURE__ */ new Set();
  const targets = /* @__PURE__ */ new Set();
  const targetRefs = [];
  for (const target of source.targets) {
    const key = refToString(target);
    if (!targets.has(key)) {
      targets.add(key);
      targetRefs.push(target);
    }
    if (isCascadingToChildren(source)) {
      const children = getChildrenOfReference(target, tree);
      for (const child of children) {
        const childKey = refToString(child);
        if (!targets.has(childKey)) {
          targets.add(childKey);
          targetRefs.push(child);
        }
      }
    }
  }
  for (const target of targetRefs) {
    const lookupRef = genericize(target);
    const key = refToString(lookupRef);
    const dependants = triggerablesPerTrigger.get(key);
    if (dependants) {
      for (const dep of dependants) {
        allDependantTriggerables.add(dep);
      }
    }
  }
  return allDependantTriggerables;
}
function getChildrenOfReference(target, tree) {
  if (!tree) return [];
  const node = resolveReference(tree, target);
  if (!node) return [];
  const childRefs = [];
  collectChildRefs(target, node.children, childRefs);
  return childRefs;
}
function collectChildRefs(parentRef, children, result) {
  for (const child of children) {
    const childRef = genericize(extendRef(parentRef, child.name));
    result.push(childRef);
    collectChildRefs(childRef, child.children, result);
  }
}
function buildDag(allTriggerables, edges) {
  const dag = [];
  const remainingVertices = new Set(allTriggerables);
  let remainingEdges = [...edges];
  while (remainingVertices.size > 0) {
    const nonRoots = /* @__PURE__ */ new Set();
    for (const [, target] of remainingEdges) {
      nonRoots.add(target);
    }
    const roots = [];
    for (const v of remainingVertices) {
      if (!nonRoots.has(v)) {
        roots.push(v);
      }
    }
    if (roots.length === 0) {
      throwCycleDetected(allTriggerables);
    }
    for (const root of roots) {
      remainingVertices.delete(root);
      dag.push(root);
    }
    const rootSet = new Set(roots);
    remainingEdges = remainingEdges.filter(([src]) => !rootSet.has(src));
  }
  return dag;
}
function buildRelevancePerRepeat(triggerablesDAG, tree) {
  const relevancePerRepeat = /* @__PURE__ */ new Map();
  if (!tree) return relevancePerRepeat;
  for (const triggerable of triggerablesDAG) {
    if (triggerable.kind !== "condition" || triggerable.action !== "relevant") {
      continue;
    }
    for (const target of triggerable.targets) {
      const key = refToString(genericize(target));
      if (hasTemplate(target, tree)) {
        relevancePerRepeat.set(key, triggerable);
      }
    }
  }
  return relevancePerRepeat;
}
function hasTemplate(target, tree) {
  const node = resolveReference(tree, target);
  return node !== null && node.multiplicity === INDEX_TEMPLATE;
}
function throwCycleDetected(triggerables) {
  const hints = [];
  for (const t of triggerables) {
    for (const r of t.targets) {
      hints.push(refToString(r));
    }
  }
  let message = "Cycle detected in form's relevant and calculation logic!";
  if (hints.length > 0) {
    message += "\nThe following nodes are likely involved in the loop:\n" + hints.join("\n");
  }
  throw new Error(message);
}
function findTriggerable(t, allTriggerables) {
  for (const existing of allTriggerables) {
    if (triggerableEquals(existing, t)) {
      return existing;
    }
  }
  return null;
}
function triggerableEquals(a, b) {
  if (a.expr !== b.expr) return false;
  if (a.triggers.length !== b.triggers.length) return false;
  const bKeys = new Set(b.triggers.map((r) => refToString(genericize(r))));
  for (const trigger of a.triggers) {
    if (!bKeys.has(refToString(genericize(trigger)))) return false;
  }
  return true;
}

// src/parse/domHelpers.ts
function childElementsByLocalName(parent, localName2) {
  const results = [];
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      const el = child;
      if (localName2 === "*" || el.localName === localName2) {
        results.push(el);
      }
    }
  }
  return results;
}
function firstByLocalName(parent, localName2) {
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      const el = child;
      if (el.localName === localName2) {
        return el;
      }
    }
  }
  return null;
}
function directTextContent(el) {
  let text = "";
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 3) {
      text += child.nodeValue ?? "";
    }
  }
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}
function textContent(el) {
  const text = (el.textContent ?? "").trim();
  return text === "" ? null : text;
}
function parseTextParts(el) {
  let result = "";
  const outputs = [];
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.nodeType === 3) {
      result += child.nodeValue ?? "";
    } else if (child.nodeType === 1) {
      const childEl = child;
      if (childEl.localName === "output") {
        result += `\${${outputs.length}}`;
        outputs.push(childEl.getAttribute("value") ?? "");
      }
    }
  }
  const trimmed = result.trim();
  return trimmed === "" ? null : { text: trimmed, outputs };
}

// src/parse/handlers.ts
function getLabelText(el) {
  const labelEl = firstByLocalName(el, "label");
  return labelEl ? textContent(labelEl) : null;
}
function getHintText(el) {
  const hintEl = firstByLocalName(el, "hint");
  return hintEl ? textContent(hintEl) : null;
}
var ITEXT_REF_RE = /jr:itext\(\s*['"]([^'"]+)['"]\s*\)/;
function getItextRefId(el) {
  if (el === null) return null;
  const refAttr = el.getAttribute("ref");
  if (refAttr === null) return null;
  const match = ITEXT_REF_RE.exec(refAttr);
  return match !== null ? match[1] ?? null : null;
}
function getChoices(el) {
  return childElementsByLocalName(el, "item").map((itemEl) => {
    const valueEl = firstByLocalName(itemEl, "value");
    const labelEl = firstByLocalName(itemEl, "label");
    if (labelEl !== null) {
      const refAttr = labelEl.getAttribute("ref");
      if (refAttr !== null) {
        const match = ITEXT_REF_RE.exec(refAttr);
        if (match !== null) {
          return {
            value: valueEl ? textContent(valueEl) ?? "" : "",
            labelText: null,
            labelIsItext: true,
            labelItextId: match[1] ?? null
          };
        }
      }
    }
    return {
      value: valueEl ? textContent(valueEl) ?? "" : "",
      labelText: labelEl ? textContent(labelEl) : null
    };
  });
}
function getItemset(el) {
  const itemsetEl = firstByLocalName(el, "itemset");
  if (itemsetEl === null) return null;
  const nodesetExpr = itemsetEl.getAttribute("nodeset") ?? "";
  if (nodesetExpr === "") {
    return null;
  }
  const valueEl = firstByLocalName(itemsetEl, "value");
  const labelEl = firstByLocalName(itemsetEl, "label");
  const geometryEl = firstByLocalName(itemsetEl, "geometry");
  const valueExpr = valueEl?.getAttribute("ref") ?? "";
  const rawLabelRef = labelEl?.getAttribute("ref") ?? "";
  const geometryExpr = geometryEl?.getAttribute("ref") ?? null;
  const itextMatch = ITEXT_REF_RE.exec(rawLabelRef);
  const labelIsItext = itextMatch !== null || /jr:itext\(/.test(rawLabelRef);
  const labelItextId = itextMatch !== null ? itextMatch[1] ?? null : null;
  const labelExpr = rawLabelRef !== "" ? rawLabelRef : "label";
  return { nodesetExpr, valueExpr, labelExpr, labelIsItext, labelItextId, geometryExpr };
}
function buildFormElements(parentEl, ctx) {
  const elements = [];
  const childEls = childElementsByLocalName(parentEl, "*");
  for (const childEl of childEls) {
    const tag = childEl.localName ?? "";
    if (tag === "group") {
      const groupRef = childEl.getAttribute("ref") ?? childEl.getAttribute("nodeset") ?? "";
      const repeatChildren = childElementsByLocalName(childEl, "repeat");
      if (repeatChildren.length === 1 && repeatChildren[0] !== void 0) {
        const repeatRef = repeatChildren[0].getAttribute("nodeset") ?? repeatChildren[0].getAttribute("ref") ?? "";
        if (groupRef !== "" && groupRef === repeatRef) {
          const promoted = buildFormElements(childEl, ctx);
          elements.push(...promoted);
          continue;
        }
      }
    }
    const handler = handlers.get(tag);
    if (handler) {
      elements.push(handler(childEl, ctx));
    }
  }
  return elements;
}
function buildChildren(el, ctx) {
  return buildFormElements(el, ctx);
}
function questionHandler(el, ctx) {
  const refAttr = el.getAttribute("ref") ?? "";
  const ref = parseAbsoluteRef(refAttr);
  const controlType = controlTypeFromTag(el.localName ?? "");
  const binding = ctx.bindings.get(refAttr) ?? null;
  const labelEl = firstByLocalName(el, "label");
  const labelText = labelEl ? textContent(labelEl) : null;
  const labelParts = labelEl ? parseTextParts(labelEl) : null;
  const innerText = labelParts?.text ?? null;
  const labelOutputs = labelParts?.outputs ?? [];
  const labelItextId = getItextRefId(labelEl);
  const itemset = getItemset(el);
  const choices = itemset !== null ? [] : getChoices(el);
  const appearance = el.getAttribute("appearance") ?? null;
  const mediatype = el.getAttribute("mediatype") ?? null;
  const hintEl = firstByLocalName(el, "hint");
  const hintText = getHintText(el);
  const hintParts = hintEl ? parseTextParts(hintEl) : null;
  const hintInnerText = hintParts?.text ?? null;
  const hintOutputs = hintParts?.outputs ?? [];
  const hintItextId = getItextRefId(hintEl);
  let rangeStart;
  let rangeEnd;
  let rangeStep;
  if (controlType === "range") {
    const startAttr = el.getAttribute("start");
    const endAttr = el.getAttribute("end");
    const stepAttr = el.getAttribute("step");
    if (startAttr !== null) {
      const parsed = parseFloat(startAttr);
      if (Number.isFinite(parsed)) rangeStart = parsed;
    }
    if (endAttr !== null) {
      const parsed = parseFloat(endAttr);
      if (Number.isFinite(parsed)) rangeEnd = parsed;
    }
    if (stepAttr !== null) {
      const parsed = parseFloat(stepAttr);
      if (Number.isFinite(parsed)) rangeStep = parsed;
    }
  }
  return {
    kind: "question",
    ref,
    controlType,
    binding,
    labelText,
    labelInnerText: innerText,
    labelOutputs,
    choices,
    itemset,
    appearance,
    mediatype,
    hintText,
    hintInnerText,
    hintOutputs,
    labelItextId,
    hintItextId,
    ...rangeStart !== void 0 ? { rangeStart } : {},
    ...rangeEnd !== void 0 ? { rangeEnd } : {},
    ...rangeStep !== void 0 ? { rangeStep } : {}
  };
}
function groupHandler(el, ctx) {
  const refAttr = el.getAttribute("ref") ?? el.getAttribute("nodeset") ?? "";
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  const appearance = el.getAttribute("appearance") ?? null;
  const hintText = getHintText(el);
  return { kind: "group", ref, labelText, children, appearance, hintText };
}
function repeatHandler(el, ctx) {
  const refAttr = el.getAttribute("nodeset") ?? el.getAttribute("ref") ?? "";
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  const countExpr = el.getAttribute("jr:count") ?? el.getAttribute("count") ?? null;
  const hintText = getHintText(el);
  return { kind: "repeat", ref, labelText, children, countExpr, hintText };
}
var handlers = /* @__PURE__ */ new Map([
  ["input", questionHandler],
  ["select1", questionHandler],
  ["select", questionHandler],
  ["rank", questionHandler],
  ["trigger", questionHandler],
  ["upload", questionHandler],
  ["range", questionHandler],
  ["secret", questionHandler],
  ["group", groupHandler],
  ["repeat", repeatHandler]
]);

// src/parse/itextParser.ts
function parseItext(modelEl) {
  if (modelEl === null) return null;
  const itextEl = firstByLocalName(modelEl, "itext");
  if (itextEl === null) return null;
  const languages = [];
  let explicitDefaultLanguage = null;
  const byLanguage = /* @__PURE__ */ new Map();
  const translationEls = childElementsByLocalName(itextEl, "translation");
  for (const transEl of translationEls) {
    const lang2 = transEl.getAttribute("lang");
    if (lang2 === null || lang2 === "") continue;
    languages.push(lang2);
    const defaultAttr = transEl.getAttribute("default");
    if (defaultAttr !== null && defaultAttr !== "false()" && defaultAttr !== "false") {
      explicitDefaultLanguage = lang2;
    }
    const translation = /* @__PURE__ */ new Map();
    const textEls = childElementsByLocalName(transEl, "text");
    for (const textEl of textEls) {
      const id2 = textEl.getAttribute("id");
      if (id2 === null || id2 === "") continue;
      const valueEls = childElementsByLocalName(textEl, "value");
      const values = [];
      if (valueEls.length === 0) {
        const parts = parseTextParts(textEl);
        if (parts !== null) {
          values.push({ form: null, text: parts.text, outputs: parts.outputs });
        }
      } else {
        for (const valueEl of valueEls) {
          const form = valueEl.getAttribute("form") ?? null;
          const parts = parseTextParts(valueEl);
          values.push({ form, text: parts?.text ?? "", outputs: parts?.outputs ?? [] });
        }
      }
      if (values.length > 0) {
        translation.set(id2, Object.freeze(values));
      }
    }
    byLanguage.set(lang2, translation);
  }
  if (languages.length === 0) return null;
  return Object.freeze({
    languages: Object.freeze(languages),
    explicitDefaultLanguage,
    byLanguage
  });
}

// src/eval/SetValueAction.ts
var EVENT_ALIASES = /* @__PURE__ */ new Map([
  ["odk-instance-first-load", "odk-instance-first-load"],
  ["xforms-ready", "odk-instance-first-load"],
  ["xforms-value-changed", "xforms-value-changed"],
  ["odk-new-repeat", "odk-new-repeat"],
  ["jr-insert", "jr-insert"],
  ["xforms-revalidate", "xforms-revalidate"]
]);
function normalizeEvent(rawEvent) {
  if (rawEvent === null) return null;
  const trimmed = rawEvent.trim();
  if (trimmed === "") return null;
  return EVENT_ALIASES.get(trimmed) ?? null;
}

// src/parse/actionParser.ts
var sharedParser3 = new PureJSExpressionParser();
function stripPredicates(rawRef) {
  return rawRef.replace(/\[[^\]]*]/g, "");
}
function deriveGenericTarget(rawRef, hostRef, sourceLocation) {
  const stripped = stripPredicates(rawRef);
  if (stripped.startsWith("/")) {
    return parseAbsoluteRef(stripped);
  }
  if (hostRef === null) {
    throw new Error(
      `setvalue: relative target ref '${rawRef}' has no host control context to resolve against (${sourceLocation}). Model-level setvalue actions must use an absolute ref (starting with '/').`
    );
  }
  const relativeLevels = parseAbsoluteRef(`/${stripped}`).levels;
  const relativeRef = {
    levels: relativeLevels
  };
  return contextualize(relativeRef, hostRef);
}
function parseSetValueActions(el, hostRef) {
  const rawEvent = el.getAttribute("event");
  const rawRef = el.getAttribute("ref");
  const sourceLocation = `<setvalue event="${rawEvent ?? ""}" ref="${rawRef ?? ""}">`;
  if (rawRef === null || rawRef === "") {
    throw new Error(`setvalue: missing required 'ref' attribute (${sourceLocation})`);
  }
  const tokens = rawEvent !== null ? rawEvent.trim().split(/\s+/).filter((t) => t.length > 0) : [];
  if (tokens.length === 0) {
    throw new Error(
      `setvalue: unsupported event '${rawEvent ?? ""}' on ref '${rawRef}' (${sourceLocation}). Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed', 'odk-new-repeat', 'jr-insert'.`
    );
  }
  const events = [];
  for (const token of tokens) {
    const event = normalizeEvent(token);
    if (event === null) {
      throw new Error(
        `setvalue: unsupported event '${token}' on ref '${rawRef}' (${sourceLocation}). Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed', 'odk-new-repeat', 'jr-insert'.`
      );
    }
    if (event === "jr-insert" && hostRef !== null) {
      throw new Error(
        `setvalue: 'jr-insert' is only supported on model-level setvalue actions, not on a body-nested <setvalue> (${sourceLocation}). Declare this action directly under <model> instead.`
      );
    }
    events.push(event);
  }
  const targetExpr = compileInstanceXPath(rawRef);
  const genericTarget = deriveGenericTarget(rawRef, hostRef, sourceLocation);
  const valueAttr = el.getAttribute("value");
  let expr = null;
  let literal = null;
  let valueDeps = [];
  if (valueAttr !== null) {
    expr = compileInstanceXPath(valueAttr);
    const parsed = sharedParser3.parse(valueAttr).rootNode;
    valueDeps = getTriggers(parsed, genericTarget, genericTarget);
  } else {
    literal = directTextContent(el) ?? "";
  }
  return events.map((event) => {
    const triggers = event === "xforms-value-changed" ? dedupeRefs([...valueDeps, ...hostRef !== null ? [hostRef] : []]) : [];
    return {
      event,
      targetSource: rawRef,
      targetExpr,
      hostRef,
      genericTarget,
      expr,
      literal,
      triggers,
      sourceLocation
    };
  });
}
function dedupeRefs(refs) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const ref of refs) {
    const key = ref.levels.map((lvl) => `${lvl.name}[${lvl.multiplicity}]`).join("/");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    }
  }
  return result;
}
function collectModelActions(modelEl) {
  if (modelEl === null) return [];
  const actions = [];
  const children = modelEl.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1 && child.localName === "setvalue") {
      actions.push(...parseSetValueActions(child, null));
    }
  }
  return actions;
}
function collectBodyActions(bodyEl) {
  if (bodyEl === null) return [];
  const actions = [];
  function walk(el, hostRef) {
    const refAttr = el.getAttribute("ref") ?? el.getAttribute("nodeset");
    let currentHostRef = hostRef;
    if (refAttr !== null && refAttr !== "" && refAttr.startsWith("/")) {
      try {
        currentHostRef = parseAbsoluteRef(refAttr);
      } catch {
        currentHostRef = hostRef;
      }
    }
    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child || child.nodeType !== 1) continue;
      const childEl = child;
      if (childEl.localName === "setvalue") {
        actions.push(...parseSetValueActions(childEl, currentHostRef));
      } else {
        walk(childEl, currentHostRef);
      }
    }
  }
  walk(bodyEl, null);
  return actions;
}

// src/parse/XFormParser.ts
var RAW_TEXT_ATTR = "__rawText";
function buildInstanceNode(el) {
  const node = newNode(el.localName ?? el.nodeName);
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && !attr.name.startsWith("xmlns")) {
      setAttribute(node, attr.name, attr.value);
    }
  }
  const isTemplate = el.getAttribute("jr:template") !== null;
  if (isTemplate) {
    node.multiplicity = INDEX_TEMPLATE;
  }
  let hasElementChildren = false;
  const sameNameCounts = /* @__PURE__ */ new Map();
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.nodeType === 1) {
      hasElementChildren = true;
      const childNode = buildInstanceNode(child);
      if (childNode.multiplicity !== INDEX_TEMPLATE) {
        const sameNameCount = sameNameCounts.get(childNode.name) ?? 0;
        childNode.multiplicity = sameNameCount;
        sameNameCounts.set(childNode.name, sameNameCount + 1);
      }
      childNode.parent = node;
      node.children.push(childNode);
    }
  }
  if (!hasElementChildren) {
    const raw = directTextContent(el);
    if (raw !== null) {
      setAttribute(node, RAW_TEXT_ATTR, raw);
    }
  }
  return node;
}
function buildInstanceTree(instanceEl) {
  const childEls = childElementsByLocalName(instanceEl, "*");
  if (childEls.length === 0) {
    return { root: newNode("instance"), name: null };
  }
  const dataRoot = childEls[0];
  const root = buildInstanceNode(dataRoot);
  const instanceId = instanceEl.getAttribute("id") ?? null;
  return { root, name: instanceId };
}
function applyBindingsToNode(node, bindings, path) {
  const currentPath = `${path}/${node.name}`;
  const binding = bindings.get(currentPath);
  if (binding) {
    node.dataType = binding.dataType;
    node.preload = binding.preload;
    node.preloadParams = binding.preloadParams;
    const rawText = getAttribute(node, RAW_TEXT_ATTR);
    if (rawText !== void 0) {
      node.value = cast(binding.dataType, rawText) ?? null;
      deleteAttribute(node, RAW_TEXT_ATTR);
    }
  } else {
    const rawText = getAttribute(node, RAW_TEXT_ATTR);
    if (rawText !== void 0) {
      node.value = cast("string", rawText) ?? null;
      deleteAttribute(node, RAW_TEXT_ATTR);
    }
  }
  for (const child of node.children) {
    applyBindingsToNode(child, bindings, currentPath);
  }
}
function applyBindings(tree, bindings) {
  applyBindingsToNode(tree.root, bindings, "");
}
function buildBody(bodyEl, bindings) {
  const ctx = { bindings };
  return buildFormElements(bodyEl, ctx);
}
function extractTitle(doc) {
  const headEl = firstDocumentElementByLocalName(doc, "head") ?? firstDocumentElementByLocalName(doc, "html") ? findByLocalNameDeep(doc.documentElement, "head") : null;
  if (!headEl) return null;
  const titleEl = firstByLocalName(headEl, "title");
  return titleEl ? textContent(titleEl) : null;
}
function firstDocumentElementByLocalName(doc, localName2) {
  const root = doc.documentElement;
  if (!root) return null;
  if (root.localName === localName2) return root;
  return firstByLocalName(root, localName2);
}
function findByLocalNameDeep(el, localName2) {
  if (el.localName === localName2) return el;
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      const found = findByLocalNameDeep(child, localName2);
      if (found) return found;
    }
  }
  return null;
}
function buildReactiveDag(bindEls, tree) {
  const allTriggerables = /* @__PURE__ */ new Set();
  const triggerablesPerTrigger = /* @__PURE__ */ new Map();
  const constraintBindings = /* @__PURE__ */ new Map();
  const processedBindings = compileBindings(bindEls);
  for (const processed of processedBindings.values()) {
    for (const cb of processed.compiledBindings) {
      if (cb.kind === "condition" && cb.action === "constraint") {
        if (cb.targets.length > 0) {
          const key = processed.nodeset;
          constraintBindings.set(key, cb);
        }
        continue;
      }
      let triggerable;
      if (cb.kind === "recalculate") {
        triggerable = makeRecalculate(
          cb.expr,
          cb.targets,
          cb.triggers,
          cb.contextRef,
          cb.originalContextRef
        );
      } else {
        triggerable = makeCondition(
          cb.expr,
          cb.targets,
          cb.triggers,
          cb.contextRef,
          cb.originalContextRef,
          cb.action
        );
      }
      addTriggerable(triggerable, allTriggerables, triggerablesPerTrigger);
    }
  }
  const dag = finalizeDag(allTriggerables, triggerablesPerTrigger, tree);
  return { dag, constraintBindings };
}
function parseDocument(doc) {
  const root = doc.documentElement;
  if (!root) {
    return { title: null, mainInstance: { root: newNode("data"), name: null }, bindings: /* @__PURE__ */ new Map(), body: [], dag: null, constraintBindings: /* @__PURE__ */ new Map(), itext: null, secondaryInstances: /* @__PURE__ */ new Map(), externalInstances: /* @__PURE__ */ new Map(), actions: [] };
  }
  const headEl = findByLocalNameDeep(root, "head");
  const modelEl = headEl ? findByLocalNameDeep(headEl, "model") : null;
  const instanceEls = modelEl ? childElementsByLocalName(modelEl, "instance") : [];
  const mainInstanceEl = instanceEls.find((e) => !e.hasAttribute("id")) ?? instanceEls[0] ?? null;
  const mainInstance = mainInstanceEl ? buildInstanceTree(mainInstanceEl) : { root: newNode("data"), name: null };
  const secondaryInstances = /* @__PURE__ */ new Map();
  const externalInstances = /* @__PURE__ */ new Map();
  for (const el of instanceEls) {
    const id2 = el.getAttribute("id");
    if (id2 === null || id2 === "") {
      continue;
    }
    const src = el.getAttribute("src");
    if (src !== null && src !== "") {
      externalInstances.set(id2, { src });
      continue;
    }
    const secTree = buildInstanceTree(el);
    applyBindings(secTree, /* @__PURE__ */ new Map());
    secondaryInstances.set(id2, secTree);
  }
  const bindEls = modelEl ? childElementsByLocalName(modelEl, "bind") : [];
  const bindings = bindProcessor(bindEls);
  const { dag, constraintBindings } = buildReactiveDag(bindEls, mainInstance);
  const bodyEl = findByLocalNameDeep(root, "body");
  const body = bodyEl ? buildBody(bodyEl, bindings) : [];
  applyBindings(mainInstance, bindings);
  const title = extractTitle(doc);
  const itext2 = parseItext(modelEl);
  const actions = [
    ...collectModelActions(modelEl),
    ...collectBodyActions(bodyEl)
  ];
  return { title, mainInstance, bindings, body, dag, constraintBindings, itext: itext2, secondaryInstances, externalInstances, actions };
}
function parseForm(xml) {
  const doc = getXmlParser().parse(xml);
  return parseDocument(doc);
}

// src/session/AnswerResult.ts
var AnswerResult = /* @__PURE__ */ ((AnswerResult2) => {
  AnswerResult2["OK"] = "OK";
  AnswerResult2["REQUIRED_BUT_EMPTY"] = "REQUIRED_BUT_EMPTY";
  AnswerResult2["CONSTRAINT_VIOLATED"] = "CONSTRAINT_VIOLATED";
  AnswerResult2["RANK_INVALID"] = "RANK_INVALID";
  return AnswerResult2;
})(AnswerResult || {});

// src/model/def/Itext.ts
function makeItextResolver(t) {
  let activeLanguage = t.explicitDefaultLanguage ?? t.languages[0] ?? null;
  function resolveEntry(translation, id2, form) {
    if (translation === void 0) return null;
    const values = translation.get(id2);
    if (values === void 0 || values.length === 0) return null;
    if (form !== void 0) {
      const match = values.find((v) => v.form === form);
      if (match !== void 0) return match;
    }
    const defaultMatch = values.find((v) => v.form === null);
    if (defaultMatch !== void 0) return defaultMatch;
    return values[0] ?? null;
  }
  function resolveValue(translation, id2, form) {
    return resolveEntry(translation, id2, form)?.text ?? null;
  }
  return {
    getLanguages() {
      return t.languages;
    },
    getActiveLanguage() {
      return activeLanguage;
    },
    setActiveLanguage(lang2) {
      if (lang2 === null) {
        activeLanguage = t.explicitDefaultLanguage ?? t.languages[0] ?? null;
        return activeLanguage;
      }
      if (!t.languages.includes(lang2)) {
        throw new Error(
          `Language "${lang2}" is not available. Available languages: ${t.languages.join(", ")}`
        );
      }
      activeLanguage = lang2;
      return activeLanguage;
    },
    resolve(id2, form) {
      if (activeLanguage !== null) {
        const activeTrans = t.byLanguage.get(activeLanguage);
        const result = resolveValue(activeTrans, id2, form);
        if (result !== null) return result;
      }
      for (const lang2 of t.languages) {
        if (lang2 === activeLanguage) continue;
        const trans = t.byLanguage.get(lang2);
        const result = resolveValue(trans, id2, form);
        if (result !== null) return result;
      }
      return null;
    },
    resolveWithOutputs(id2, form) {
      if (activeLanguage !== null) {
        const activeTrans = t.byLanguage.get(activeLanguage);
        const entry = resolveEntry(activeTrans, id2, form);
        if (entry !== null) return { text: entry.text, outputs: entry.outputs };
      }
      for (const lang2 of t.languages) {
        if (lang2 === activeLanguage) continue;
        const trans = t.byLanguage.get(lang2);
        const entry = resolveEntry(trans, id2, form);
        if (entry !== null) return { text: entry.text, outputs: entry.outputs };
      }
      return null;
    },
    resolveExactForm(id2, form) {
      function exactMatch(translation) {
        const values = translation?.get(id2);
        return values?.find((v) => v.form === form)?.text ?? null;
      }
      if (activeLanguage !== null) {
        const result = exactMatch(t.byLanguage.get(activeLanguage));
        if (result !== null) return result;
      }
      for (const lang2 of t.languages) {
        if (lang2 === activeLanguage) continue;
        const result = exactMatch(t.byLanguage.get(lang2));
        if (result !== null) return result;
      }
      return null;
    }
  };
}

// src/model/state/NodeState.ts
function defaultNodeState() {
  return {
    relevant: true,
    enabled: true,
    required: false,
    readonly: false,
    constraintMsg: null,
    calculatedValue: null
  };
}

// src/platform/ReactiveObjectFactory.ts
var identityReactiveFactory = (initial) => initial;

// src/model/validation/rankPermutation.ts
function checkRankPermutation(tokens, choiceValues) {
  if (tokens.length === 0) {
    return { valid: true };
  }
  const answerCounts = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    answerCounts.set(token, (answerCounts.get(token) ?? 0) + 1);
  }
  const choiceCounts = /* @__PURE__ */ new Map();
  for (const value of choiceValues) {
    choiceCounts.set(value, (choiceCounts.get(value) ?? 0) + 1);
  }
  const duplicateTokens = [];
  const seenForDuplicate = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    if (seenForDuplicate.has(token)) continue;
    seenForDuplicate.add(token);
    const answerCount = answerCounts.get(token) ?? 0;
    const choiceCount = choiceCounts.get(token) ?? 0;
    if (answerCount > choiceCount && choiceCount > 0) {
      duplicateTokens.push(token);
    }
  }
  const missingTokens = [];
  const seenForMissing = /* @__PURE__ */ new Set();
  for (const value of choiceValues) {
    if (seenForMissing.has(value)) continue;
    seenForMissing.add(value);
    const choiceCount = choiceCounts.get(value) ?? 0;
    const answerCount = answerCounts.get(value) ?? 0;
    if (answerCount < choiceCount) {
      missingTokens.push(value);
    }
  }
  const foreignTokens = [];
  const seenForForeign = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    if (seenForForeign.has(token)) continue;
    seenForForeign.add(token);
    if (!choiceCounts.has(token)) {
      foreignTokens.push(token);
    }
  }
  const violations = [];
  if (duplicateTokens.length > 0) {
    violations.push({ kind: "duplicate", tokens: duplicateTokens });
  }
  if (missingTokens.length > 0) {
    violations.push({ kind: "missing", tokens: missingTokens });
  }
  if (foreignTokens.length > 0) {
    violations.push({ kind: "foreign", tokens: foreignTokens });
  }
  if (violations.length === 0) {
    return { valid: true };
  }
  return { valid: false, violations };
}

// src/session/FormEvaluator.ts
var FormEvaluator = class _FormEvaluator {
  tree;
  docNode;
  /** Reactive DAG — set by initializeInstance; null until a form with bindings is loaded. */
  dag = null;
  /**
   * setvalue ActionRegistry — set by setActionRegistry (session-creation
   * time, src/session/FormSession.ts). Null when the form declares no
   * setvalue actions (buildActionRegistry always returns a non-null
   * registry, but a session that never calls setActionRegistry — e.g. tests
   * constructing FormEvaluator directly — has no actions to fire).
   * sdd/setvalue-actions PR2.
   */
  actionRegistry = null;
  /** NodeState per bound node — keyed by refToString(genericize(ref)). */
  nodeStates = /* @__PURE__ */ new Map();
  /** Factory for creating reactive node state objects (default: identity). */
  factory;
  /**
   * Compiled constraint expressions, keyed by nodeset string (e.g. "/data/a").
   * Set by initializeInstance from the FormDefinition.constraintBindings.
   */
  constraintBindings = /* @__PURE__ */ new Map();
  /** Itext resolver for the active session. Null when form has no itext. */
  itextResolver;
  /** Wrapped secondary instance roots, keyed by id. Read by native instance() fn via docNode. */
  secondaryDocs;
  /** Body element tree — used to find ItemsetDef by ref in getChoices(). */
  body = [];
  /**
   * Cache for dynamic choice results, keyed by question ref string.
   * Each entry stores the trigger-signature computed when choices were last
   * evaluated; a changed signature triggers recomputation.
   */
  choiceCache = /* @__PURE__ */ new Map();
  /**
   * Equality-filter itemset index, mirroring JavaRosa's
   * EqualityExpressionIndexFilterStrategy: for the common
   * `instance('id')/path/item[column = ref]` choice_filter shape, index all
   * candidate items by `column`'s string value ONCE (built lazily, on first
   * use, keyed by instance id + item path + column name), so that every
   * subsequent choice_filter evaluation against a DIFFERENT ref value (e.g.
   * the user picking a different municipio) is an O(1) map lookup instead
   * of a full O(n) rescan of the secondary instance. Safe to cache for the
   * lifetime of this FormEvaluator: secondaryDocs/tree are populated once in
   * the constructor and never replaced (see FormSession.createFormSession).
   */
  itemsetIndexCache = /* @__PURE__ */ new Map();
  constructor(tree, opts) {
    this.tree = tree;
    let factory;
    let itextTranslations = null;
    let secondaryInstances;
    if (opts === void 0) {
      factory = void 0;
    } else if (typeof opts === "function") {
      factory = opts;
    } else {
      factory = opts.factory;
      itextTranslations = opts.itext ?? null;
      secondaryInstances = opts.secondaryInstances;
      this.body = opts.body ?? [];
    }
    this.factory = factory ?? identityReactiveFactory;
    this.itextResolver = itextTranslations !== null ? makeItextResolver(itextTranslations) : null;
    if (secondaryInstances !== void 0 && secondaryInstances.size > 0) {
      const docs = /* @__PURE__ */ new Map();
      for (const [id2, secTree] of secondaryInstances) {
        const secDoc = makeInstanceDocumentNode(secTree);
        docs.set(id2, secDoc);
      }
      this.secondaryDocs = docs;
    } else {
      this.secondaryDocs = /* @__PURE__ */ new Map();
    }
    const docNodeOpts = this.secondaryDocs.size > 0 ? { itext: this.itextResolver, secondaryInstances: this.secondaryDocs } : { itext: this.itextResolver };
    this.docNode = makeInstanceDocumentNode(tree, docNodeOpts);
  }
  // ---------------------------------------------------------------------------
  // Slice 5a — language management
  // ---------------------------------------------------------------------------
  /**
   * Switch the active language for itext resolution.
   * Throws when `lang` is not in the form's translation list (REQ-5A-4).
   * Passing null resets to the default language.
   * No-op when the form has no itext block.
   */
  setLanguage(lang2) {
    if (this.itextResolver === null) {
      return null;
    }
    return this.itextResolver.setActiveLanguage(lang2);
  }
  /**
   * Return the list of available languages (in declaration order).
   * Returns empty array when form has no itext.
   */
  getLanguages() {
    return this.itextResolver?.getLanguages() ?? [];
  }
  /**
   * Return the currently active language.
   * Returns null when form has no itext.
   */
  getActiveLanguage() {
    return this.itextResolver?.getActiveLanguage() ?? null;
  }
  /**
   * Resolve an itext id to its string value in the active language.
   * Returns null when the id is absent in all languages.
   * Returns null when form has no itext.
   */
  resolveItext(id2) {
    return this.itextResolver?.resolve(id2) ?? null;
  }
  /**
   * Resolve an itext id to its {text, outputs} pair in the active language.
   * Returns null when the id is absent in all languages, or when the form
   * has no itext. Added in output-label-substitution PR3.
   */
  resolveItextWithOutputs(id2) {
    return this.itextResolver?.resolveWithOutputs(id2) ?? null;
  }
  /**
   * Resolve an itext id's media form (e.g. "image", "audio", "video",
   * "big-image") to its raw, unresolved reference string (e.g.
   * "jr://images/map.svg"). Requires an exact form match — never falls back
   * to the label's default text. Returns null when absent or when the form
   * has no itext.
   */
  resolveItextMedia(id2, form) {
    return this.itextResolver?.resolveExactForm(id2, form) ?? null;
  }
  // ---------------------------------------------------------------------------
  // output-label-substitution PR3 — read-time <output> substitution
  // ---------------------------------------------------------------------------
  /**
   * Replace each `${n}` placeholder in `template` with the string result of
   * evaluating `outputs[n]` against `node` (the question's context node).
   * Reuses the same relative-context XPath evaluator as itemset value/label
   * resolution (evaluateRelativeOnNode) — no new evaluation mechanism.
   *
   * Invalid/empty XPath results substitute as an empty string (JavaRosa
   * parity for FormEntryPrompt#substituteStringArgs); evaluation errors are
   * caught and never propagate to the caller.
   */
  substituteOutputs(template, outputs, node) {
    if (outputs.length === 0) return template;
    return template.replace(/\$\{(\d+)\}/g, (_match, idxStr) => {
      const output = outputs[Number(idxStr)];
      if (output === void 0) return "";
      try {
        return this.evaluateRelativeOnNode(output, node);
      } catch {
        return "";
      }
    });
  }
  /**
   * Read-time substitution entry point for question label/hint text.
   *
   * Resolves `contextRef`'s InstanceNode (the question's own ref — repeat-
   * relative outputs like `../name` resolve against THIS specific instance,
   * not the primary instance root) and substitutes every `${n}` placeholder
   * in `template` using `outputs`. Returns `template` unchanged when there
   * are no outputs (cheap no-op path). Returns `null` when `template` is
   * `null`. Never throws.
   */
  substituteText(template, outputs, contextRef) {
    if (template === null) return null;
    if (outputs.length === 0) return template;
    const contextNode = resolveReference(this.tree, contextRef);
    const ctx = this.makeContext(contextNode);
    return this.substituteOutputs(template, outputs, ctx.contextNode);
  }
  // ---------------------------------------------------------------------------
  // Slice 5c — dynamic choice resolution
  // ---------------------------------------------------------------------------
  /**
   * Get the dynamic choices for the question at `ref`.
   *
   * Algorithm (JavaRosa-style on-demand):
   *  1. Find the question's ItemsetDef via the body tree.
   *  2. If no itemset → return static choices (mapped to SelectChoice, resolving itext labels).
   *  3. Compute trigger-signature: string-values of form-field triggers in nodesetExpr predicates.
   *  4. Cache hit (same sig) → return cached.
   *  5. Cache miss → evaluate nodesetExpr as nodeset, map each result node to SelectChoice.
   *
   * Choices reflect instance state AT CALL TIME (REQ-5C-4 stale-choice contract).
   */
  getChoices(ref) {
    const refKey = refToString(ref);
    const questionEl = this.findQuestionByRef(ref);
    if (questionEl === null || questionEl.itemset === null) {
      return (questionEl?.choices ?? []).map((c) => ({
        value: c.value,
        label: c.labelIsItext === true && c.labelItextId != null ? this.itextResolver?.resolve(c.labelItextId) ?? c.labelText : c.labelText
      }));
    }
    const itemset = questionEl.itemset;
    const triggerSig = this.computeTriggerSig(itemset.nodesetExpr, ref, itemset.labelIsItext);
    const cached = this.choiceCache.get(refKey);
    if (cached !== void 0 && cached.triggerSig === triggerSig) {
      return cached.choices;
    }
    const contextNode = resolveReference(this.tree, ref);
    const ctx = this.makeContext(contextNode);
    const fastPathNodes = this.tryEqualityFilterFastPath(itemset, ctx.contextNode);
    const choices = [];
    if (fastPathNodes !== null) {
      for (const node of fastPathNodes) {
        const value = this.evaluateRelativeOnNode(itemset.valueExpr, node);
        const label = this.resolveChoiceLabel(itemset, node);
        const geometry = itemset.geometryExpr !== null ? this.evaluateRelativeOnNode(itemset.geometryExpr, node) || null : null;
        choices.push({ value, label, geometry });
      }
    } else {
      const result = evaluateInstanceExpr(
        itemset.nodesetExpr,
        ctx.contextNode,
        XPATH_EVALUATION_RESULT.ANY_TYPE
      );
      let node = result.iterateNext();
      while (node !== null) {
        if (node.kind === "element") {
          const value = this.evaluateRelativeOnNode(itemset.valueExpr, node);
          const label = this.resolveChoiceLabel(itemset, node);
          const geometry = itemset.geometryExpr !== null ? this.evaluateRelativeOnNode(itemset.geometryExpr, node) || null : null;
          choices.push({ value, label, geometry });
        }
        node = result.iterateNext();
      }
    }
    const frozen = Object.freeze(choices);
    this.choiceCache.set(refKey, { triggerSig, choices: frozen });
    return frozen;
  }
  // Matches: instance('id')/seg1/seg2.../item[ column = ref ]  (either operand
  // order). Deliberately conservative — no nested brackets, no compound
  // predicates, no functions — anything else falls through to null and the
  // generic evaluator runs unchanged.
  static EQUALITY_FILTER_SHAPE_RE = /^instance\((['"])([^'"]*)\1\)((?:\/[A-Za-z_][\w\-.]*)+)\[\s*([^[\]=]+?)\s*=\s*([^[\]=]+?)\s*\]$/;
  static isBareName(s) {
    return /^[A-Za-z_][\w\-.]*$/.test(s);
  }
  /**
   * Fast path for the classic choice_filter shape
   * `instance('id')/path/item[column = ref]` (JavaRosa's
   * EqualityExpressionIndexFilterStrategy equivalent): index all candidate
   * items by `column`'s string value once, then serve every subsequent
   * distinct `ref` value as an O(1) lookup instead of rescanning the whole
   * secondary instance through the generic XPath evaluator. Returns null
   * (falling back to the generic evaluator, unchanged) whenever the shape
   * isn't recognized with full confidence — this must never guess.
   */
  tryEqualityFilterFastPath(itemset, questionContextNode) {
    const match = _FormEvaluator.EQUALITY_FILTER_SHAPE_RE.exec(itemset.nodesetExpr.trim());
    if (match === null) return null;
    const [, , instanceId, pathExpr, lhsRaw, rhsRaw] = match;
    const segments = pathExpr.split("/").filter((s) => s.length > 0);
    if (segments.length < 2) return null;
    const lhsIsBare = _FormEvaluator.isBareName(lhsRaw);
    const rhsIsBare = _FormEvaluator.isBareName(rhsRaw);
    let columnName;
    let refExpr;
    if (lhsIsBare && !rhsIsBare) {
      columnName = lhsRaw;
      refExpr = rhsRaw;
    } else if (rhsIsBare && !lhsIsBare) {
      columnName = rhsRaw;
      refExpr = lhsRaw;
    } else {
      return null;
    }
    const doc = this.secondaryDocs.get(instanceId);
    if (doc === void 0 || doc.kind !== "document") return null;
    const root = doc.tree.root;
    if (root.name !== segments[0]) return null;
    let parent = root;
    for (let i = 1; i < segments.length - 1; i++) {
      const matches = childrenNamed(parent, segments[i]);
      if (matches.length !== 1) return null;
      parent = matches[0];
    }
    const itemName = segments[segments.length - 1];
    const items = childrenNamed(parent, itemName);
    const literalMatch = /^(['"])([^'"]*)\1$/.exec(refExpr);
    const targetValue = literalMatch !== null ? literalMatch[2] : evaluateInstanceExpr(refExpr, questionContextNode, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
    const cacheKey = JSON.stringify([instanceId, pathExpr, columnName]);
    let index = this.itemsetIndexCache.get(cacheKey);
    if (index === void 0) {
      const built = /* @__PURE__ */ new Map();
      for (const item of items) {
        const col = childrenNamed(item, columnName)[0];
        if (col === void 0) continue;
        const key = answerValueToXPathString(col.value);
        let bucket = built.get(key);
        if (bucket === void 0) {
          bucket = [];
          built.set(key, bucket);
        }
        bucket.push(item);
      }
      index = built;
      this.itemsetIndexCache.set(cacheKey, index);
    }
    const matchedItems = index.get(targetValue) ?? [];
    return matchedItems.map((item) => wrapInstanceNode(item, doc));
  }
  /**
   * @experimental
   * Fully clears the choice cache.
   *
   * Used by FormNavigator.deleteRepeat: after a repeat instance is removed,
   * remaining sibling instances are re-indexed (shifted down), so a cache
   * entry keyed by a concrete ref may now describe a DIFFERENT instance than
   * the one it was computed for. getChoices' triggerSig check does not catch
   * this when two instances happen to share the same trigger value(s), so an
   * explicit full-clear is required for correctness. Full-clear (rather than
   * subtree-scoped) is the simplest correct option and is consistent with the
   * already-accepted full-DAG-rerun cost model for repeat removal.
   */
  invalidateChoiceCache() {
    this.choiceCache.clear();
  }
  /**
   * Resolve a choice label for one itemset result node.
   *
   * This is the single coordination point between 5a (itext) and 5c (itemset).
   * - labelIsItext = false → evaluate labelExpr as XPath string against the node.
   * - labelIsItext = true, labelItextId non-null → static itext id, resolve directly.
   * - labelIsItext = true, labelItextId null → evaluate labelExpr as XPath to get
   *   the runtime itext id, then resolve that id.
   */
  resolveChoiceLabel(itemset, node) {
    if (!itemset.labelIsItext) {
      return this.evaluateRelativeOnNode(itemset.labelExpr, node) || null;
    }
    let itextId;
    if (itemset.labelItextId !== null) {
      itextId = itemset.labelItextId;
    } else {
      const innerMatch = /jr:itext\(\s*(.+?)\s*\)/s.exec(itemset.labelExpr);
      if (innerMatch === null) {
        itextId = itemset.labelExpr;
      } else {
        const innerExpr = innerMatch[1];
        itextId = this.evaluateRelativeOnNode(innerExpr, node);
      }
    }
    return this.itextResolver?.resolve(itextId) ?? null;
  }
  /**
   * Evaluate a relative XPath expression against an InstanceXPathNode.
   * Returns the string result (or empty string on error/empty nodeset).
   */
  evaluateRelativeOnNode(expr, node) {
    return this.withActiveChoiceNameResolver(() => {
      const result = evaluateInstanceExpr(expr, node, XPATH_EVALUATION_RESULT.ANY_TYPE);
      switch (result.resultType) {
        case XPATH_EVALUATION_RESULT.STRING_TYPE:
          return result.stringValue;
        case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
          return String(result.numberValue);
        case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
          return result.booleanValue ? "true" : "false";
        default: {
          const first = result.iterateNext();
          if (first === null) return "";
          return evaluateInstanceExpr("string(.)", first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
        }
      }
    });
  }
  /**
   * Run `fn` with the active jr:choice-name() resolver set to this
   * FormEvaluator's own resolveChoiceName, restoring whatever was active
   * before on exit (safe for nested/re-entrant calls, and for multiple
   * FormEvaluator instances alive at once — see setActiveChoiceNameResolver).
   */
  withActiveChoiceNameResolver(fn2) {
    const previous = getActiveChoiceNameResolver();
    setActiveChoiceNameResolver((node, value) => this.resolveChoiceName(node, value));
    try {
      return fn2();
    } finally {
      setActiveChoiceNameResolver(previous);
    }
  }
  /**
   * Implements jr:choice-name()'s node-side contract (XPathChoiceNode):
   * given an InstanceElementNode bound to a select/select1 question and a
   * choice value/token, resolve that choice's label — static or itemset,
   * itext-translated if applicable. Reuses getChoices() entirely (same
   * cache, same static/itemset branching, same itext resolution) rather
   * than duplicating any of that logic here.
   *
   * Returns null when `node` isn't bound to a recognized select question or
   * `value` doesn't match any of its choices — jr:choice-name() then
   * returns '' rather than throwing (fail-soft: a form-authoring mistake
   * shouldn't crash the session).
   */
  resolveChoiceName(node, value) {
    const ref = this.nodeToRef(node);
    if (ref === null) return null;
    return this.getChoices(ref).find((c) => c.value === value)?.label ?? null;
  }
  /**
   * Compute a trigger signature for the given nodesetExpr.
   *
   * Extracts trigger references from predicates in nodesetExpr using getTriggers,
   * evaluates their current string values, and concatenates them with a separator.
   * A changed signature means the filtered result set may differ → cache invalidated.
   *
   * When no triggers are found (e.g. unfiltered secondary instance), returns a
   * constant string → permanent cache hit (correct: secondary instances are immutable).
   */
  computeTriggerSig(nodesetExpr, questionRef, labelIsItext = false) {
    try {
      const parser = new PureJSExpressionParser();
      const parsed = parser.parse(nodesetExpr);
      const triggers = getTriggers(parsed.rootNode, questionRef, questionRef);
      const triggerPart = triggers.length === 0 ? "__no_triggers__" : triggers.map((t) => String(this.evaluateOnInstance(refToString(t)))).join("");
      const langPart = labelIsItext ? `${this.itextResolver?.getActiveLanguage() ?? ""}` : "";
      return triggerPart + langPart;
    } catch {
      return String(Date.now());
    }
  }
  /**
   * Find the question FormElement for the given ref by walking the body tree.
   * Returns null if not found or if the body is empty.
   */
  findQuestionByRef(ref) {
    const refKey = refToString(genericize(ref));
    let found = null;
    function walk(elements) {
      for (const el of elements) {
        if (el.kind === "question") {
          if (refToString(el.ref) === refKey) {
            found = el;
            return;
          }
        } else {
          walk(el.children);
        }
      }
    }
    walk(this.body);
    return found;
  }
  /**
   * Applicability + delegation for the rank permutation rule.
   *
   * Returns null when the rule does not apply (empty value, non-selectMulti
   * kind, no question element, non-'rank' control, or an unresolved dynamic
   * itemset). Returns a RankPermutationResult when the rule was evaluated.
   *
   * See sdd/rank-validation design §2.3.
   */
  checkRank(ref, value) {
    if (value === null || isAnswerEmpty(value)) return null;
    if (value.kind !== "selectMulti") return null;
    const questionEl = this.findQuestionByRef(ref);
    if (questionEl === null) return null;
    if (questionEl.controlType !== "rank") return null;
    const choices = this.getChoices(ref);
    if (questionEl.itemset !== null && choices.length === 0) return null;
    return checkRankPermutation(value.value, choices.map((c) => c.value));
  }
  // ---------------------------------------------------------------------------
  // NodeState management
  // ---------------------------------------------------------------------------
  /**
   * Get or create NodeState for a genericized ref key.
   */
  getOrCreateState(key) {
    let state = this.nodeStates.get(key);
    if (state === void 0) {
      state = this.factory(defaultNodeState());
      this.nodeStates.set(key, state);
    }
    return state;
  }
  /**
   * Return the effective relevance of a ref: own relevant AND all ancestors relevant.
   *
   * Mirrors JavaRosa TriggerableDag isEffectivelyRelevant — walks the ref's
   * parent chain consulting own NodeState.relevant for each ancestor.
   */
  isEffectivelyRelevant(ref) {
    let current2 = ref;
    while (current2.levels.length > 0) {
      const navKey = refToString(current2);
      const genericKey = refToString(genericize(current2));
      const concreteLevels = current2.levels.map(
        (l, i) => i > 0 && l.multiplicity < 0 ? level(l.name, 0) : l
      );
      const fullConcreteKey = refToString({ ...current2, levels: Object.freeze(concreteLevels) });
      const navState = this.nodeStates.get(navKey);
      const concreteState = navKey !== fullConcreteKey ? this.nodeStates.get(fullConcreteKey) : void 0;
      const definiteState = navState ?? concreteState;
      if (definiteState !== void 0) {
        if (!definiteState.relevant) return false;
      } else if (genericKey !== navKey) {
        const genericState = this.nodeStates.get(genericKey);
        if (genericState !== void 0 && !genericState.relevant) {
          return false;
        }
      }
      current2 = parentOf(current2);
    }
    return true;
  }
  /**
   * Get the NodeState for a ref (by genericized key). Returns undefined if not found.
   */
  getNodeState(ref) {
    return this.nodeStates.get(refToString(genericize(ref)));
  }
  // ---------------------------------------------------------------------------
  // Slice 3.1 — XPath evaluation primitives
  // ---------------------------------------------------------------------------
  /**
   * Build an InstanceEvaluationContext for a given context InstanceNode.
   * When contextNode is null/undefined the document root is used.
   */
  makeContext(contextNode) {
    const ctxWrapper = contextNode != null ? wrapInstanceNode(contextNode, this.docNode) : wrapInstanceNode(this.tree.root, this.docNode);
    return {
      instanceRoot: this.docNode,
      contextNode: ctxWrapper
    };
  }
  /**
   * Evaluate an XPath expression string over the InstanceTree.
   *
   * Returns a primitive (string | number | boolean) or the first node's
   * string-value when the result is a nodeset.
   */
  evaluateOnInstance(expr, contextNode) {
    return this.withActiveChoiceNameResolver(() => {
      const ctx = this.makeContext(contextNode);
      const result = evaluateInstanceExpr(expr, ctx.contextNode, XPATH_EVALUATION_RESULT.ANY_TYPE);
      switch (result.resultType) {
        case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
          return result.booleanValue;
        case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
          return result.numberValue;
        case XPATH_EVALUATION_RESULT.STRING_TYPE:
          return result.stringValue;
        default: {
          const first = result.iterateNext();
          if (first === null) return "";
          return evaluateInstanceExpr("string(.)", first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
        }
      }
    });
  }
  /**
   * Evaluate a pre-compiled instance expression with the active relevance closure.
   * Used by the DAG-based cascade.
   */
  evaluateCompiled(compiled, contextNode) {
    const ctx = this.makeContext(contextNode);
    setActiveRelevanceCheck((node) => {
      if (node.kind !== "element") return true;
      const nodeRef = this.nodeToRef(node);
      if (nodeRef === null) return true;
      return this.isEffectivelyRelevant(nodeRef);
    });
    const previousChoiceNameResolver = getActiveChoiceNameResolver();
    setActiveChoiceNameResolver((node, value) => this.resolveChoiceName(node, value));
    let result;
    try {
      result = compiled.evaluate(ctx);
    } finally {
      setActiveRelevanceCheck(null);
      setActiveChoiceNameResolver(previousChoiceNameResolver);
    }
    if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
      return result;
    }
    const nodes = result;
    if (nodes.length === 0) return "";
    const first = nodes[0];
    if (first === void 0) return "";
    return evaluateInstanceExpr("string(.)", first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
  }
  /**
   * Derive a concrete TreeReference from an InstanceXPathNode by walking its parent chain.
   *
   * Per design §8: accumulates (name, positional multiplicity among same-name non-template siblings).
   * The resulting ref has concrete multiplicities (0-indexed position) at each level,
   * allowing per-instance NodeState keys and indexed-repeat unwrapping.
   *
   * Returns null if the node cannot be mapped (e.g. document node).
   */
  nodeToRef(node) {
    if (node.kind !== "element") return null;
    const levels = [];
    let current2 = node.node;
    while (current2 !== null) {
      const curNode = current2;
      const parentNode = curNode.parent;
      let multiplicity = curNode.multiplicity;
      if (parentNode !== null) {
        const sameNameSiblings = parentNode.children.filter(
          (c) => c.name === curNode.name && c.multiplicity !== INDEX_TEMPLATE
        );
        const idx = sameNameSiblings.indexOf(curNode);
        multiplicity = idx >= 0 ? idx : curNode.multiplicity;
      }
      levels.unshift({ name: curNode.name, multiplicity });
      current2 = parentNode;
    }
    const refLevels = levels.map(({ name: name2, multiplicity }, i) => {
      return level(name2, i === 0 ? INDEX_UNBOUND : multiplicity);
    });
    return Object.freeze({
      refLevel: REF_ABSOLUTE,
      contextType: "absolute",
      instanceName: null,
      levels: Object.freeze(refLevels)
    });
  }
  /** Expose the document node for callers that need to build their own contexts. */
  getDocumentNode() {
    return this.docNode;
  }
  /** Wrap an InstanceNode into an InstanceXPathNode for use in evaluations. */
  wrap(node) {
    return wrapInstanceNode(node, this.docNode);
  }
  /**
   * Determine whether an InstanceNode is effectively relevant.
   *
   * Reuses the existing private nodeToRef + isEffectivelyRelevant path (ADR-2).
   * Returns true when the ref cannot be derived (root or unresolvable nodes are
   * always considered relevant — no NodeState marks root non-relevant).
   *
   * Slice 6a — used by FormSession.serializeToXml to build the isRelevant
   * callback for serializeInstance without duplicating ref-derivation logic.
   */
  isNodeRelevant(node) {
    const xpathNode = this.wrap(node);
    const ref = this.nodeToRef(xpathNode);
    if (ref === null) return true;
    return this.isEffectivelyRelevant(ref);
  }
  // ---------------------------------------------------------------------------
  // Slice 3.4 — reactive cascade engine
  // ---------------------------------------------------------------------------
  /**
   * Initialize all triggerables in topological DAG order.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables (FormDef.java:447-466).
   * Called once at session creation to bring the instance to steady state.
   *
   * Slice 3.5: also initializes NodeState for all bound nodes, and evaluates
   * all Conditions (relevant/required/readonly) to set initial NodeState.
   */
  initializeInstance(dag, constraintBindings) {
    this.dag = dag;
    if (constraintBindings !== void 0) {
      this.constraintBindings = constraintBindings;
    }
    for (const triggerable of dag.triggerablesDAG) {
      for (const target of triggerable.targets) {
        const key = refToString(genericize(target));
        this.getOrCreateState(key);
      }
    }
    for (const triggerable of dag.triggerablesDAG) {
      if (triggerable.kind === "recalculate") {
        this.applyRecalculate(triggerable, null);
      } else if (triggerable.kind === "condition") {
        this.applyCondition(triggerable, null);
      }
    }
  }
  /**
   * Write a value to the InstanceNode at ref, then trigger the reactive cascade.
   *
   * Mirrors JavaRosa FormDef.setValue + triggerTriggerables.
   * Option A: there is NO parallel DOM — the InstanceTree is the sole data store.
   */
  setValue(ref, value) {
    const node = resolveReference(this.tree, ref);
    if (node !== null) {
      node.value = value;
    }
  }
  /**
   * Trigger the cascade for a changed ref.
   *
   * Algorithm (mirrors JavaRosa TriggerableDag.triggerTriggerables):
   *   1. genericize changedRef → look up triggerablesPerTrigger
   *   2. Expand all downstream triggerables transitively via immediateCascades
   *   3. Iterate triggerablesDAG IN ORDER; evaluate only those in the toTrigger set
   *
   * @param changedRef  The ref that changed (used for lookup and context).
   * @param dag         Optional override dag. Defaults to the stored dag.
   */
  triggerTriggerables(changedRef, dag) {
    const activeDag = dag !== void 0 ? dag : this.dag;
    if (activeDag === null) return;
    const useDag = activeDag;
    const genericRef = genericize(changedRef);
    const key = refToString(genericRef);
    const cascadeRoots = useDag.triggerablesPerTrigger.get(key);
    if (cascadeRoots !== void 0 && cascadeRoots.size > 0) {
      const toTrigger = getAllToTrigger(cascadeRoots, useDag.immediateCascades);
      const ordered = Array.from(toTrigger).sort(
        (a, b) => useDag.triggerableIndex.get(a) - useDag.triggerableIndex.get(b)
      );
      for (const triggerable of ordered) {
        if (triggerable.kind === "recalculate") {
          this.applyRecalculate(triggerable, changedRef);
        } else if (triggerable.kind === "condition") {
          this.applyCondition(triggerable, changedRef);
        }
      }
    }
    if (this.actionRegistry !== null) {
      const valueChangedActions = this.actionRegistry.valueChangedByTrigger.get(key);
      if (valueChangedActions !== void 0) {
        for (const action of valueChangedActions) {
          this.fireAction(action);
        }
      }
    }
  }
  /**
   * Install the setvalue ActionRegistry built from the session's
   * FormDefinition.actions (src/eval/ActionRegistry.ts). Must be called
   * before fireLoadActions(). A no-op call with an empty registry is safe —
   * fireLoadActions() then does nothing.
   *
   * sdd/setvalue-actions PR2, task 9.
   */
  setActionRegistry(registry) {
    this.actionRegistry = registry;
  }
  /**
   * Fire all `odk-instance-first-load` (and `xforms-ready`-aliased) setvalue
   * actions, in declaration order, exactly once.
   *
   * Mirrors JavaRosa ActionController.triggerActionsFromEvent for the
   * FORM_LOAD event. Must be called AFTER initializeInstance's DAG cascade
   * has already brought the instance to its initial steady state (design
   * ADR-4) — a load action's value expression should see fully-cascaded
   * calculates, and each action's own triggerTriggerables call re-cascades
   * any downstream dependents of its target.
   *
   * Per design's edit-mode decision: ODK/XForms defines `odk-instance-first-load`
   * as firing whenever the instance is instantiated into the engine, including an
   * edit-mode reload of a previous submission — so this fires unconditionally on
   * both fresh and hydrated (instanceXml) sessions. It happens to align with
   * calculate's existing "always overwrite loaded values" behavior at
   * instantiation time, but a load-time setvalue is a one-shot imperative write,
   * not a standing declarative rule re-evaluated on every cascade like calculate —
   * the two are not architecturally identical, only aligned on this one point.
   * Grouped with `calculate` (fires), not with `preload` (skipped on hydration).
   *
   * sdd/setvalue-actions PR2, tasks 10-12.
   */
  fireLoadActions() {
    if (this.actionRegistry === null) return;
    for (const action of this.actionRegistry.loadActions) {
      this.fireAction(action);
    }
  }
  /**
   * Fire all `xforms-revalidate` setvalue actions, in declaration order.
   *
   * Mirrors JavaRosa FormDef#postProcessInstance, which triggers
   * EVENT_XFORMS_REVALIDATE before its own preload-postProcess tree walk.
   * Called from FormSession.finalize() — the finalize/submission lifecycle
   * point that previously did not exist in ts-rosa (docs/XLSFORM-COVERAGE.md).
   */
  fireRevalidateActions() {
    if (this.actionRegistry === null) return;
    const revalidateActions = this.actionRegistry.byEvent.get("xforms-revalidate");
    if (revalidateActions === void 0) return;
    for (const action of revalidateActions) {
      this.fireAction(action);
    }
  }
  /**
   * Runtime re-entrancy depth counter bounding chained `xforms-value-changed`
   * action cascades (design ADR-2). Static DAG cycle detection (finalizeDag)
   * cannot see actions — they are not DAG vertices (ADR-1) — so a build-time
   * "Cycle detected" check never fires for an action-only cycle (action A's
   * write cascades into action B, whose write cascades back into A, etc.).
   * fireAction increments this before its own triggerTriggerables call and
   * decrements it in a finally block, so the counter reflects chain DEPTH
   * (nesting), not breadth (sibling actions fired from the same tail do not
   * accumulate against each other).
   */
  actionChainDepth = 0;
  /** sdd/setvalue-actions PR3, design ADR-2: fail-loud bound for chained actions. */
  static MAX_ACTION_CHAIN_DEPTH = 16;
  /**
   * Evaluate a single setvalue action's value expression (or literal),
   * write the typed result into its target node, then propagate through the
   * standard DAG cascade.
   *
   * Mirrors JavaRosa Action.processAction -> setValue -> triggerTriggerables
   * (design section 4). Bypasses answerQuestion's constraint gating on
   * purpose (ADR-3) — action writes are not user-entered answers.
   *
   * sdd/setvalue-actions PR3: tracks/enforces the MAX_ACTION_CHAIN_DEPTH
   * re-entrancy guard (ADR-2) — throws fail-loud once a chain of
   * value-changed actions triggering each other exceeds the bound, rather
   * than looping indefinitely or silently truncating (spec Requirement 7).
   */
  fireAction(action, contextNode) {
    this.actionChainDepth++;
    try {
      if (this.actionChainDepth > _FormEvaluator.MAX_ACTION_CHAIN_DEPTH) {
        throw new Error(
          `setvalue action chain exceeded max depth ${_FormEvaluator.MAX_ACTION_CHAIN_DEPTH} (possible cycle) at ${action.sourceLocation}`
        );
      }
      this.fireActionInner(action, contextNode);
    } finally {
      this.actionChainDepth--;
    }
  }
  /**
   * Resolves `action.targetExpr` at fire time via the XPath seam
   * (`evaluateTyped` → NODESET), replacing the pre-parity parse-time
   * `TreeReference`-based lookup. Design Decisions 2/3 (sdd/setvalue-parity):
   * a target that resolves to 0 or >1 nodes, or to a non-NODESET result, now
   * throws fail-loud instead of silently no-op'ing (accepted breaking change,
   * no deprecation path).
   */
  fireActionInner(action, contextNode) {
    const hostNode = contextNode !== void 0 ? contextNode : action.hostRef !== null ? resolveReference(this.tree, action.hostRef) : null;
    const ctx = this.makeContext(hostNode);
    const result = action.targetExpr.evaluateTyped(ctx);
    if (result.type !== "NODESET") {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' did not evaluate to a nodeset (${action.sourceLocation})`
      );
    }
    if (result.nodes.length === 0) {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' resolved to no nodes (${action.sourceLocation})`
      );
    }
    if (result.nodes.length > 1) {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' resolved to ${result.nodes.length} nodes; a setvalue target must be a single node (${action.sourceLocation})`
      );
    }
    const targetXPathNode = result.nodes[0];
    if (targetXPathNode.kind !== "element") {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' did not resolve to an element node (${action.sourceLocation})`
      );
    }
    const targetNode = targetXPathNode.node;
    let rawString;
    if (action.expr !== null) {
      const rawResult = this.evaluateExprFast(action.expr, targetNode);
      rawString = typeof rawResult === "string" ? rawResult : typeof rawResult === "number" ? String(rawResult) : rawResult ? "1" : "0";
    } else {
      rawString = action.literal ?? "";
    }
    targetNode.value = cast(targetNode.dataType, rawString);
    const writtenRef = this.nodeToRef(this.wrap(targetNode));
    if (writtenRef !== null) {
      this.triggerTriggerables(writtenRef);
    }
  }
  /**
   * Evaluate a Recalculate triggerable and write the result to its target nodes.
   *
   * Uses resolveAll to handle repeated nodes — each instance of the target path
   * gets its own recalculate evaluation with that instance as the context node.
   *
   * Context selection mirrors JavaRosa Recalculate.apply:
   *   - contextNode = the target node (resolved from triggerable.originalContextRef
   *     contextualized against changedRef when provided).
   *   - Result is coerced to target node's dataType via cast(dataType, string(result)).
   *
   * Slice 3.5: if the target node's parent(s) are non-relevant, effective value
   * is '' — but we still compute and write (JavaRosa: calculates fire even inside
   * non-relevant groups; only descendant nodes that depend on a non-relevant node
   * see '' via the relevanceOf closure).
   */
  applyRecalculate(t, changedRef, subtreeRoot = null) {
    for (const target of t.targets) {
      let targetNodes;
      if (subtreeRoot !== null) {
        targetNodes = resolveAllWithin(this.tree, subtreeRoot, target);
      } else if (changedRef !== null && isSafeToContextualize(t, target)) {
        targetNodes = resolveAllContextualized(this.tree, target, changedRef);
      } else {
        targetNodes = resolveAll(this.tree, target);
        if (targetNodes.length === 0) {
          const single = resolveReference(this.tree, target);
          if (single !== null) targetNodes.push(single);
        }
      }
      if (targetNodes.length > 1 && isContextIndependent(t.expr.source)) {
        const firstNode = targetNodes[0];
        const rawResult = this.evaluateExprFast(t.expr, firstNode);
        const rawString = typeof rawResult === "string" ? rawResult : typeof rawResult === "number" ? String(rawResult) : rawResult ? "1" : "0";
        const v = cast(firstNode.dataType, rawString);
        for (const targetNode of targetNodes) {
          targetNode.value = v;
        }
      } else {
        for (const targetNode of targetNodes) {
          const rawResult = this.evaluateExprFast(t.expr, targetNode);
          const rawString = typeof rawResult === "string" ? rawResult : typeof rawResult === "number" ? String(rawResult) : rawResult ? "1" : "0";
          targetNode.value = cast(targetNode.dataType, rawString);
        }
      }
    }
  }
  evaluateExprFast(compiled, ctx) {
    if (compiled.source === "position(..)") {
      const p = ctx.parent;
      if (p !== null) {
        const s = p.children.filter((c) => c.name === ctx.name && c.multiplicity !== INDEX_TEMPLATE);
        return s.indexOf(ctx) + 1;
      }
      return 1;
    }
    return this.evaluateCompiled(compiled, ctx);
  }
  /**
   * Recalculate a triggerable whose triggers are all outside the newly
   * created repeat subtree.
   *
   * Deliberately full-tree (NOT scoped to subtreeRoot, unlike
   * applyRecalculate's Fix B): when an outside trigger changes (e.g. an
   * absolute count() used by every repeat instance), adding one new
   * instance must re-propagate the new value to ALL existing sibling
   * instances too, not just the new one — see the
   * "count(/data/repeat) outside is propagated to inner-count after add
   * and remove" equivalence test.
   *
   * The one broadcast (evaluate once, copy to every same-grandparent node)
   * is safe ONLY when isContextIndependent(t.expr.source) is true — i.e.
   * the expression has no relative/position dependency, so every target
   * node would evaluate to the exact same value anyway (mirrors
   * applyRecalculate's own context-independent broadcast optimization).
   * Without this guard, a position()/`..`-relative expression (e.g. a
   * calculate that distributes an outside select-multi's items across
   * repeat instances via `selected-at(x, position(..)-1)`) would have one
   * instance's value silently copied onto every other same-grandparent
   * instance — each instance must instead be evaluated in its own context.
   */
  applyRecalculateGrouped(t, subtreeRoot) {
    for (const target of t.targets) {
      const nodes = resolveAll(this.tree, target);
      if (nodes.length <= 1) {
        for (const n of nodes) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
        }
        continue;
      }
      if (!isContextIndependent(t.expr.source)) {
        for (const n of nodes) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
        }
        continue;
      }
      const byGp = /* @__PURE__ */ new Map();
      for (const n of nodes) {
        const gp = n.parent?.parent ?? null;
        if (gp === null) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
          continue;
        }
        let g = byGp.get(gp);
        if (!g) {
          g = [];
          byGp.set(gp, g);
        }
        g.push(n);
      }
      for (const group of byGp.values()) {
        const f = group[0];
        const raw = this.evaluateExprFast(t.expr, f);
        const s = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : raw ? "1" : "0";
        const v = cast(f.dataType, s);
        for (const n of group) n.value = v;
      }
    }
  }
  /**
   * For multi-instance conditions, evaluate the predicate expression scoped to
   * each concrete parent — not the document root.
   *
   * JavaRosa evaluates each triggerable's expression once per affected concrete node
   * using that node's concrete context (EvaluationContext with the concrete ref).
   * For position()-dependent expressions this must be done as a child-step predicate
   * from the parent so position() returns the node's position among same-name siblings.
   *
   * Algorithm:
   *   1. Group targetNodes by their parent InstanceNode (concrete parent).
   *   2. For each unique parent, evaluate `{nodeName}[{exprSource}]` with the parent
   *      as the context node — this is a child-axis step with the predicate.
   *   3. Collect all nodes in the result nodeset into the returned Set.
   *
   * This correctly handles:
   *   - `position() > 2` on top-level repeats (parent = /data, position is 1-based among siblings)
   *   - `../consent = 'yes'` on nested repeats (parent = concrete /data/household[N], so `..`
   *     resolves to that specific household — no cross-household leakage)
   */
  evaluateRelevantSetByConcreteParent(targetNodes, compiled, exprSource) {
    const relevantNodes = /* @__PURE__ */ new Set();
    const nodesByParent = /* @__PURE__ */ new Map();
    for (const node of targetNodes) {
      const parent = node.parent;
      if (parent === null) {
        const raw = this.evaluateCompiled(compiled, node);
        if (toBoolean(raw)) {
          relevantNodes.add(node);
        }
        continue;
      }
      let group = nodesByParent.get(parent);
      if (group === void 0) {
        group = [];
        nodesByParent.set(parent, group);
      }
      group.push(node);
    }
    for (const [parent, nodes] of nodesByParent) {
      const nodeName = nodes[0].name;
      const parentCtx = this.makeContext(parent);
      const stepExpr = `${nodeName}[${exprSource}]`;
      const result = evaluateInstanceExpr(stepExpr, parentCtx.contextNode, XPATH_EVALUATION_RESULT.ANY_TYPE);
      let xpathNode = result.iterateNext();
      while (xpathNode !== null) {
        if (xpathNode.kind === "element") {
          relevantNodes.add(xpathNode.node);
        }
        xpathNode = result.iterateNext();
      }
    }
    return relevantNodes;
  }
  /**
   * Evaluate a Condition triggerable and update NodeState for its target nodes.
   *
   * Uses resolveAll to handle repeated nodes — each instance of the target path
   * gets its own condition evaluation with that instance as the context node.
   * NodeState is stored per concrete instance (with position-specific key) when
   * multiple instances exist; single instances use the genericized key.
   *
   * Mirrors JavaRosa Condition.apply (Condition.java).
   * Action semantics:
   *   relevant  → state.relevant = boolean(result); then propagate inherited relevance
   *   required  → state.required = boolean(result)
   *   readonly  → state.readonly = boolean(result); state.enabled = !state.readonly
   *
   * After updating own relevant, propagates inherited relevance to descendants
   * (ancestor walk semantics: a node is non-relevant if any ancestor is non-relevant).
   */
  applyCondition(t, changedRef, subtreeRoot = null) {
    for (const target of t.targets) {
      let targetNodes;
      if (subtreeRoot !== null) {
        targetNodes = resolveAllWithin(this.tree, subtreeRoot, target);
      } else if (changedRef !== null && isSafeToContextualize(t, target)) {
        targetNodes = resolveAllContextualized(this.tree, target, changedRef);
      } else {
        targetNodes = resolveAll(this.tree, target);
        if (targetNodes.length === 0) {
          const single = resolveReference(this.tree, target);
          if (single !== null) targetNodes.push(single);
        }
      }
      const genericKey = refToString(genericize(target));
      const hasMultipleInstances = targetNodes.length > 1;
      let relevantSetForTarget = null;
      if (hasMultipleInstances && t.action === "relevant") {
        relevantSetForTarget = this.evaluateRelevantSetByConcreteParent(targetNodes, t.expr, t.expr.source);
      }
      for (const targetNode of targetNodes) {
        let boolResult;
        if (relevantSetForTarget !== null) {
          boolResult = relevantSetForTarget.has(targetNode);
        } else {
          const rawResult = this.evaluateCompiled(t.expr, targetNode);
          boolResult = toBoolean(rawResult);
        }
        const concreteRef = this.nodeToRef(wrapInstanceNode(targetNode, this.docNode));
        const concreteKey = concreteRef !== null ? refToString(concreteRef) : genericKey;
        const concreteState = this.getOrCreateState(concreteKey);
        const state = concreteState;
        switch (t.action) {
          case "relevant":
            state.relevant = boolResult;
            if (hasMultipleInstances) {
              const genericState = this.getOrCreateState(genericKey);
              genericState.relevant = boolResult;
            } else {
              if (concreteKey !== genericKey) {
                const genericState = this.getOrCreateState(genericKey);
                genericState.relevant = boolResult;
              }
            }
            this.propagateRelevanceToDescendants(targetNode);
            break;
          case "required":
            state.required = boolResult;
            if (concreteKey !== genericKey) {
              this.getOrCreateState(genericKey).required = boolResult;
            }
            break;
          case "readonly":
            state.readonly = boolResult;
            state.enabled = !boolResult;
            if (concreteKey !== genericKey) {
              const g = this.getOrCreateState(genericKey);
              g.readonly = boolResult;
              g.enabled = !boolResult;
            }
            break;
        }
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Slice 3.6 — Constraint validation + answerQuestion + validate()
  // ---------------------------------------------------------------------------
  /**
   * Answer a question with constraint checking.
   *
   * Algorithm (mirrors JavaRosa FormEntryController.answerQuestion):
   *   1. If value is non-null AND a constraint binding exists for ref:
   *      evaluate constraint in context of ref; if false → CONSTRAINT_VIOLATED (no commit).
   *   2. Empty/null value → constraint always satisfied (skip eval).
   *   3. setValue(ref, value) + triggerTriggerables(ref).
   *   4. Return OK.
   */
  answerQuestion(ref, value) {
    const nodeset = refToString(ref);
    const rankResult = this.checkRank(ref, value);
    if (rankResult !== null && !rankResult.valid) {
      return "RANK_INVALID" /* RANK_INVALID */;
    }
    const constraintCb = this.constraintBindings.get(nodeset);
    if (value !== null && constraintCb !== void 0) {
      const targetNode = resolveReference(this.tree, ref);
      if (targetNode !== null) {
        const previousValue = targetNode.value;
        targetNode.value = value;
        let constraintResult;
        try {
          constraintResult = this.evaluateCompiled(constraintCb.expr, targetNode);
        } finally {
          targetNode.value = previousValue;
        }
        if (!toBoolean(constraintResult)) {
          return "CONSTRAINT_VIOLATED" /* CONSTRAINT_VIOLATED */;
        }
      }
    }
    this.setValue(ref, value);
    this.triggerTriggerables(ref);
    return "OK" /* OK */;
  }
  /**
   * Full-form validation sweep.
   *
   * Mirrors JavaRosa TriggerableDag.validate() (TriggerableDag.java:409-439).
   * Iterates all bindings in the NodeState map order, checking:
   *   1. effectivelyRelevant && required && value empty → REQUIRED_BUT_EMPTY
   *   2. non-null value && constraint binding exists → eval constraint → CONSTRAINT_VIOLATED
   *
   * Returns the first failure, or null if the form is valid.
   */
  validate(allNodesets) {
    for (const nodeset of allNodesets) {
      const ref = parseAbsoluteRef(nodeset);
      const node = resolveReference(this.tree, ref);
      if (node === null) continue;
      const stateKey = refToString(genericize(ref));
      const state = this.nodeStates.get(stateKey);
      const isRelevant = this.isEffectivelyRelevant(ref);
      if (isRelevant && state?.required === true && isAnswerEmpty(node.value)) {
        return { failedNodeset: nodeset, status: "REQUIRED_BUT_EMPTY" /* REQUIRED_BUT_EMPTY */ };
      }
      const rankResult = this.checkRank(ref, node.value);
      if (rankResult !== null && !rankResult.valid) {
        return { failedNodeset: nodeset, status: "RANK_INVALID" /* RANK_INVALID */ };
      }
      const constraintCb = this.constraintBindings.get(nodeset);
      if (constraintCb !== void 0 && !isAnswerEmpty(node.value)) {
        const constraintResult = this.evaluateCompiled(constraintCb.expr, node);
        if (!toBoolean(constraintResult)) {
          return { failedNodeset: nodeset, status: "CONSTRAINT_VIOLATED" /* CONSTRAINT_VIOLATED */ };
        }
      }
    }
    return null;
  }
  /**
   * Initialize a newly added repeat instance by running all triggerables
   * whose targets are under the given repeat root ref.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables called on a new
   * repeat instance: re-evaluates all DAG triggerables in topological order,
   * allowing those that target the new instance to fire.
   *
   * Called from Scenario.createNewRepeat after adding the node to the tree.
   *
   * @param repeatRootRef  The concrete positional ref of the new repeat instance
   *                       (e.g. /data/repeat[1], multiplicity=1)
   */
  initializeRepeatInstance(repeatRootRef) {
    if (this.dag === null) return;
    const subtreeRoot = resolveReference(this.tree, repeatRootRef);
    const rootGeneric = refToString(genericize(repeatRootRef));
    const subtreePrefix = rootGeneric + "/";
    if (this.actionRegistry !== null) {
      const registry = this.actionRegistry;
      for (const action of registry.byEvent.get("jr-insert") ?? []) {
        this.fireAction(action);
      }
      for (const action of registry.byEvent.get("odk-new-repeat") ?? []) {
        if (action.hostRef === null) {
          this.fireAction(action);
        }
      }
      for (const [scopeKey, scopedActions] of registry.newRepeatByScope) {
        if (scopeKey !== rootGeneric && !scopeKey.startsWith(subtreePrefix)) continue;
        for (const action of scopedActions) {
          const hostRef = action.hostRef;
          const hostNode = subtreeRoot !== null ? resolveAllWithin(this.tree, subtreeRoot, hostRef)[0] ?? subtreeRoot : null;
          this.fireAction(action, hostNode);
        }
      }
    }
    const subtreeRoots = /* @__PURE__ */ new Set();
    for (const triggerable of this.dag.triggerablesDAG) {
      const hasTargetInSubtree = triggerable.targets.some((tgt) => {
        const k = refToString(tgt);
        return k === rootGeneric || k.startsWith(subtreePrefix);
      });
      const hasTriggerInSubtree = triggerable.triggers.some((tr) => {
        const k = refToString(tr);
        return k === rootGeneric || k.startsWith(subtreePrefix);
      });
      if (hasTargetInSubtree || hasTriggerInSubtree) {
        subtreeRoots.add(triggerable);
      }
    }
    const toTrigger = getAllToTrigger(subtreeRoots, this.dag.immediateCascades);
    for (const triggerable of this.dag.triggerablesDAG) {
      if (!toTrigger.has(triggerable)) continue;
      if (triggerable.kind === "recalculate") {
        const hasTriggers = triggerable.triggers.length > 0;
        const allInside = hasTriggers && triggerable.triggers.every(
          (t) => refToString(t).startsWith(subtreePrefix)
        );
        const allOutside = hasTriggers && triggerable.triggers.every((t) => {
          const k = refToString(t);
          return k !== rootGeneric && !k.startsWith(subtreePrefix);
        });
        if (allInside) {
          this.applyRecalculate(triggerable, repeatRootRef, subtreeRoot);
        } else if (allOutside && subtreeRoot !== null) {
          this.applyRecalculateGrouped(triggerable, subtreeRoot);
        } else {
          this.applyRecalculate(triggerable, repeatRootRef, null);
        }
      } else if (triggerable.kind === "condition") {
        this.applyCondition(triggerable, repeatRootRef, subtreeRoot);
      }
    }
  }
  /**
   * Re-trigger all triggerables that depend on nodes within the given repeat
   * path. Called after a repeat instance is removed to update counts, cascades, etc.
   *
   * @param genericRepeatRef  The genericized ref of the repeat (e.g. /data/repeat)
   */
  triggerRepeatRemoval(genericRepeatRef) {
    if (this.dag === null) return;
    const genericKey = refToString(genericRepeatRef);
    const cascadeRoots = this.dag.triggerablesPerTrigger.get(genericKey);
    if (cascadeRoots && cascadeRoots.size > 0) {
      this.triggerTriggerables(genericRepeatRef);
    }
    for (const triggerable of this.dag.triggerablesDAG) {
      if (triggerable.kind === "recalculate") {
        this.applyRecalculate(triggerable, genericRepeatRef);
      } else if (triggerable.kind === "condition") {
        this.applyCondition(triggerable, genericRepeatRef);
      }
    }
  }
  /**
   * Walk all descendant InstanceNodes of a node and ensure their effective
   * relevance is consistent with the ancestor walk rule.
   *
   * This does NOT set state.relevant on descendants — only own NodeState.relevant
   * reflects the Condition expression result. Effective relevance is always
   * computed on-the-fly by isEffectivelyRelevant (ancestor walk).
   *
   * This method exists to trigger any downstream recalculates that depend on
   * nodes inside the subtree (via a future event system). For now it is a no-op
   * beyond the ancestor walk built into isEffectivelyRelevant.
   *
   * NOTE (spec S3.5): calculates inside a non-relevant group STILL fire — but
   * descendants that depend on a non-relevant node see '' via relevanceOf closure.
   */
  propagateRelevanceToDescendants(_node) {
  }
};
function getAllToTrigger(cascadeRoots, immediateCascades) {
  const toTrigger = /* @__PURE__ */ new Set();
  const queue = [...cascadeRoots];
  while (queue.length > 0) {
    const current2 = queue.shift();
    if (toTrigger.has(current2)) continue;
    toTrigger.add(current2);
    const downstream = immediateCascades.get(current2);
    if (downstream) {
      for (const dep of downstream) {
        if (!toTrigger.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }
  return toTrigger;
}
var AGGREGATE_FUNCTIONS = /\b(count|sum|max|min|avg|count-non-empty)\s*\(/;
function isContextIndependent(src) {
  let tokens;
  try {
    tokens = tokenize(src);
  } catch {
    return false;
  }
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : null;
    const next = i < tokens.length - 1 ? tokens[i + 1] : null;
    switch (tok.kind) {
      // .. — parent axis shorthand
      case "DOTDOT" /* DOTDOT */:
        return false;
      // . — self/context node
      case "DOT" /* DOT */:
        return false;
      // @ — attribute axis shorthand
      case "AT" /* AT */:
        return false;
      // current(), position(), last() — always context-dependent.
      // name(), local-name(), namespace-uri(), string(), number(),
      // normalize-space(), string-length() — context-dependent in their
      // zero-argument form (they implicitly operate on the context node).
      // Blocked unconditionally: over-blocking the rare arg form
      // (e.g. name(/abs/path)) only costs a perf miss (falls back to
      // per-instance eval), which is correctness-safe.
      case "FUNCTION_NAME" /* FUNCTION_NAME */:
        if (tok.text === "current" || tok.text === "position" || tok.text === "last" || tok.text === "name" || tok.text === "local-name" || tok.text === "namespace-uri" || tok.text === "string" || tok.text === "number" || tok.text === "normalize-space" || tok.text === "string-length")
          return false;
        break;
      // Named axis (ancestor::, self::, parent::, descendant::, attribute::, etc.)
      // AXIS_NAME tokens are always context-dependent — the tokenizer only emits
      // AXIS_NAME when the token is followed by '::'.
      case "AXIS_NAME" /* AXIS_NAME */:
        return false;
      // NAME token: a relative path step UNLESS it is preceded by / or //
      // (absolute child step) or followed by ( (function call).
      case "NAME" /* NAME */: {
        const precededBySlash = prev !== null && (prev.kind === "SLASH" /* SLASH */ || prev.kind === "SLASHSLASH" /* SLASHSLASH */);
        const followedByLparen = next !== null && next.kind === "LPAREN" /* LPAREN */;
        if (!precededBySlash && !followedByLparen) return false;
        break;
      }
      // node()/text()/comment()/processing-instruction() as a relative step.
      // NODE_TYPE is only context-dependent when used as a step — i.e. NOT
      // preceded by / or //, which would make it an absolute step.
      case "NODE_TYPE" /* NODE_TYPE */: {
        const precededBySlash = prev !== null && (prev.kind === "SLASH" /* SLASH */ || prev.kind === "SLASHSLASH" /* SLASHSLASH */);
        if (!precededBySlash) return false;
        break;
      }
      // * (WILDCARD) and ns:* (PREFIXED_WILDCARD) as a relative name-test step.
      // Context-dependent unless preceded by / or //, which makes it an
      // absolute child step (e.g. /data/rep/* is safe).
      case "WILDCARD" /* WILDCARD */:
      case "PREFIXED_WILDCARD" /* PREFIXED_WILDCARD */: {
        const precededBySlash = prev !== null && (prev.kind === "SLASH" /* SLASH */ || prev.kind === "SLASHSLASH" /* SLASHSLASH */);
        if (!precededBySlash) return false;
        break;
      }
    }
  }
  return true;
}
function isSafeToContextualize(t, target) {
  const targetStr = refToString(target);
  for (const trigger of t.triggers) {
    const trigStr = refToString(trigger);
    if (targetStr.startsWith(trigStr + "/") || targetStr === trigStr) {
      return false;
    }
  }
  const src = t.expr.source;
  if (src.includes("//")) return false;
  if (AGGREGATE_FUNCTIONS.test(src) && src.includes("..")) return false;
  if (/\bcurrent\s*\(\s*\)/.test(src)) return false;
  if (/\b(ancestor|descendant|following-sibling|preceding-sibling|following|preceding|namespace|attribute)\s*::/.test(src)) return false;
  return true;
}
function isAnswerEmpty(value) {
  if (value === null || value === void 0) return true;
  if (typeof value.value === "string") return value.value === "";
  if (Array.isArray(value.value)) return value.value.length === 0;
  return false;
}
function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  const s = value.trim().toLowerCase();
  return s === "true" || s === "1";
}

// src/session/FormIndex.ts
var beginningOfForm = Object.freeze({ kind: "bof" });
var endOfForm = Object.freeze({ kind: "eof" });
function atIndex(path, ref) {
  return Object.freeze({ kind: "at", path: Object.freeze([...path]), ref });
}
function isBof(i) {
  return i.kind === "bof";
}
function isEof(i) {
  return i.kind === "eof";
}
function isAt(i) {
  return i.kind === "at";
}

// src/session/FormEntryEvent.ts
var FORM_ENTRY_EVENT = {
  BEGINNING_OF_FORM: 0,
  END_OF_FORM: 1,
  PROMPT_NEW_REPEAT: 2,
  QUESTION: 4,
  GROUP: 8,
  REPEAT: 16
};

// src/session/FormNavigator.ts
var FormNavigator = class {
  constructor(definition, tree, evaluator) {
    this.definition = definition;
    this.tree = tree;
    this.evaluator = evaluator;
  }
  definition;
  tree;
  evaluator;
  /** Current cursor position. Starts at BOF. */
  currentIndex = beginningOfForm;
  // ---------------------------------------------------------------------------
  // Cursor queries (Slice 4.1)
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Returns the current cursor position.
   */
  getCurrentIndex() {
    return this.currentIndex;
  }
  /**
   * @experimental
   * Returns true when the cursor is past the last event (EOF).
   */
  atTheEndOfForm() {
    return isEof(this.currentIndex);
  }
  /**
   * @experimental
   * Returns true when the cursor is positioned AT a question element.
   */
  atQuestion() {
    if (!isAt(this.currentIndex)) return false;
    const resolved = this.resolvePath(this.currentIndex.path);
    return resolved !== null && resolved.element.kind === "question";
  }
  /**
   * @experimental
   * Returns the TreeReference for the given index (defaults to current cursor).
   * Returns null when the index is BOF or EOF.
   */
  refAtIndex(idx) {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) return null;
    return target.ref;
  }
  /**
   * @experimental
   * Returns the TreeReference at the NEXT relevant position without permanently
   * moving the cursor. Mirrors JavaRosa Scenario.nextRef() which does:
   *   silentNext(); ref = refAtIndex(); silentPrev(); return ref.
   *
   * This is relevance-aware (skips non-relevant positions) but NON-MUTATING:
   * it does NOT call createModelIfNecessary (no instance-tree side effects).
   * Returns null when the next relevant position is EOF.
   */
  nextRef() {
    let next = this.incrementIndex(this.currentIndex);
    while (isAt(next)) {
      if (!this.isStopRelevant(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      if (this.isExhaustedCountRepeat(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      break;
    }
    if (!isAt(next)) {
      const one = this.incrementIndex(this.currentIndex);
      if (isAt(one) && one.ref) {
        const resolved = this.resolvePath(one.path);
        if (resolved !== null && resolved.element.kind === "repeat" && resolveReference(this.tree, one.ref) === null) {
          return one.ref;
        }
      }
      return null;
    }
    return next.ref;
  }
  /**
   * Returns true when `idx` is a count-controlled repeat junction whose
   * instance does not exist AND whose multiplicity has reached (or exceeded)
   * the count expression value — meaning createModelIfNecessary would skip it.
   * Non-mutating: does NOT create any instances.
   */
  isExhaustedCountRepeat(idx) {
    const resolved = this.resolvePath(idx.path);
    if (resolved === null || resolved.element.kind !== "repeat") return false;
    const repeat = resolved.element;
    if (repeat.countExpr == null) return false;
    if (resolveReference(this.tree, idx.ref) !== null) return false;
    const lastLvl = idx.ref.levels[idx.ref.levels.length - 1];
    const firstInstanceRef = { ...idx.ref, levels: [...idx.ref.levels.slice(0, -1), level(lastLvl.name, 0)] };
    const existingInstance = resolveReference(this.tree, firstInstanceRef);
    let countCtx = existingInstance;
    if (countCtx === null && idx.ref.levels.length > 1) {
      const parentRef = { ...idx.ref, levels: idx.ref.levels.slice(0, -1) };
      const parentNode = resolveReference(this.tree, parentRef);
      if (parentNode !== null) {
        countCtx = parentNode.children.find((c) => c.multiplicity !== INDEX_TEMPLATE) ?? null;
      }
    }
    const countVal = this.evaluator.evaluateOnInstance(repeat.countExpr, countCtx);
    const count2 = typeof countVal === "number" ? countVal : Number(countVal);
    if (isNaN(count2)) return false;
    const lastLevel = idx.path[idx.path.length - 1];
    const multiplicity = lastLevel?.multiplicity ?? 0;
    return multiplicity >= count2;
  }
  /**
   * @experimental
   * Classify a FormIndex into a FormEntryEvent without moving the cursor.
   * Mirrors JavaRosa FormEntryModel.getEvent(FormIndex).
   */
  eventAt(idx) {
    if (isBof(idx)) {
      return { kind: "beginning-of-form", code: FORM_ENTRY_EVENT.BEGINNING_OF_FORM, index: idx };
    }
    if (isEof(idx)) {
      return { kind: "end-of-form", code: FORM_ENTRY_EVENT.END_OF_FORM, index: idx };
    }
    const resolved = this.resolvePath(idx.path);
    if (resolved === null) {
      return { kind: "end-of-form", code: FORM_ENTRY_EVENT.END_OF_FORM, index: endOfForm };
    }
    const { element } = resolved;
    if (element.kind === "question") {
      return { kind: "question", code: FORM_ENTRY_EVENT.QUESTION, index: idx };
    }
    if (element.kind === "group") {
      return { kind: "group", code: FORM_ENTRY_EVENT.GROUP, index: idx };
    }
    const instanceExists = resolveReference(this.tree, idx.ref) !== null;
    if (instanceExists) {
      return { kind: "repeat", code: FORM_ENTRY_EVENT.REPEAT, index: idx };
    }
    return { kind: "prompt-new-repeat", code: FORM_ENTRY_EVENT.PROMPT_NEW_REPEAT, index: idx };
  }
  /**
   * @experimental
   * Convenience alias: eventAt(idx ?? currentIndex).
   * Mirrors JavaRosa FormEntryController.getEvent().
   */
  getEvent(idx) {
    return this.eventAt(idx ?? this.currentIndex);
  }
  // ---------------------------------------------------------------------------
  // Raw walk — relevance-blind (Slice 4.2)
  // Ported line-by-line from FormEntryModel.incrementHelper / decrementHelper
  // (LINEAR mode only; NON_LINEAR / INDEX_REPEAT_JUNCTURE branches omitted).
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Returns the next FormIndex after `idx`, descending into containers when
   * `descend` is true (default). Relevance-blind — use stepToNextEvent() for
   * the relevance-skipping stepping API.
   *
   * Ported from FormEntryModel.incrementIndex(FormIndex, boolean) + incrementHelper.
   */
  incrementIndex(idx, descend = true) {
    if (isEof(idx)) return idx;
    const body = this.definition.body;
    const levels = [];
    if (isBof(idx)) {
      if (body.length === 0) return endOfForm;
    } else {
      for (const lvl of idx.path) {
        levels.push({ elementIndex: lvl.elementIndex, multiplicity: lvl.multiplicity });
      }
    }
    this.incrementHelper(levels, descend);
    return this.buildFormIndex(levels);
  }
  /**
   * @experimental
   * Returns the previous FormIndex before `idx`. Relevance-blind.
   *
   * Ported from FormEntryModel.decrementIndex(FormIndex) + decrementHelper.
   */
  decrementIndex(idx) {
    if (isBof(idx)) return idx;
    const body = this.definition.body;
    const levels = [];
    if (isEof(idx)) {
      if (body.length === 0) return beginningOfForm;
    } else {
      for (const lvl of idx.path) {
        levels.push({ elementIndex: lvl.elementIndex, multiplicity: lvl.multiplicity });
      }
    }
    this.decrementHelper(levels);
    if (levels.length === 0) return beginningOfForm;
    return this.buildFormIndex(levels);
  }
  // ---------------------------------------------------------------------------
  // Stepping with relevance skip (Slice 4.3)
  // ---------------------------------------------------------------------------
  /**
   * Returns true when an AtFormIndex position is a stop that the user should
   * see. Non-relevant positions are skipped.
   *
   * Delegates to FormEvaluator.isEffectivelyRelevant (which walks the full
   * ancestor chain via NodeState), so a non-relevant group's descendants are
   * automatically non-relevant without additional per-child checks (R4.3.5).
   *
   * For PROMPT_NEW_REPEAT positions, the repeat's own relevance is checked
   * via the genericized ref (the concrete ref has multiplicity=0 but the
   * relevance condition is stored under the generic key).
   */
  isStopRelevant(idx) {
    return this.evaluator.isEffectivelyRelevant(idx.ref);
  }
  /**
   * @experimental
   * Advance cursor, skipping non-relevant positions, until a relevant stop or
   * EOF is reached. Sets currentIndex and returns the event at the new position.
   *
   * Mirrors JavaRosa FormEntryController.stepToNextEvent (LINEAR mode):
   *   do { next = incrementIndex(next) } while next is at && not relevant
   *
   * After landing on a new position, calls createModelIfNecessary to
   * auto-create repeat instances when jr:count controls the repeat size
   * (mirrors JR FormEntryModel.setQuestionIndex → createModelIfNecessary).
   */
  stepToNextEvent() {
    let next = this.incrementIndex(this.currentIndex);
    while (isAt(next)) {
      if (!this.isStopRelevant(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      if (this.isExhaustedCountRepeat(next)) {
        next = this.incrementIndex(next);
        continue;
      }
      break;
    }
    this.currentIndex = next;
    if (isAt(next)) {
      this.createModelIfNecessary(next);
    }
    return this.eventAt(next);
  }
  /**
   * Mirrors JavaRosa FormEntryModel.createModelIfNecessary.
   * If the position is a count-controlled repeat (jr:count) and the instance
   * at the current multiplicity doesn't exist yet AND multiplicity < count,
   * auto-create the repeat instance.
   *
   * This enables navigation INTO count-controlled repeats via next() without
   * requiring an explicit createNewRepeat() call (matching JR behavior).
   */
  createModelIfNecessary(idx) {
    const resolved = this.resolvePath(idx.path);
    if (resolved === null || resolved.element.kind !== "repeat") return;
    const repeat = resolved.element;
    if (resolveReference(this.tree, idx.ref) !== null) return;
    if (repeat.countExpr != null) {
      const lastLvl = idx.ref.levels[idx.ref.levels.length - 1];
      const firstInstanceRef = { ...idx.ref, levels: [...idx.ref.levels.slice(0, -1), level(lastLvl.name, 0)] };
      const existingInstance = resolveReference(this.tree, firstInstanceRef);
      let contextNode = existingInstance;
      if (contextNode === null && idx.ref.levels.length > 1) {
        const parentRef = { ...idx.ref, levels: idx.ref.levels.slice(0, -1) };
        const parentNode = resolveReference(this.tree, parentRef);
        if (parentNode !== null && parentNode.children.length > 0) {
          contextNode = parentNode.children.find((c) => c.multiplicity !== INDEX_TEMPLATE) ?? null;
        }
      }
      const countVal = this.evaluator.evaluateOnInstance(repeat.countExpr, contextNode);
      const count2 = typeof countVal === "number" ? countVal : Number(countVal);
      if (isNaN(count2) || count2 <= 0) return;
      const lastLevel = idx.path[idx.path.length - 1];
      const multiplicity = lastLevel?.multiplicity ?? 0;
      if (multiplicity < count2) {
        const node = addRepeatInstance(this.tree, idx.ref);
        if (node !== null) {
          this.evaluator.initializeRepeatInstance(idx.ref);
        }
      }
    }
  }
  /**
   * @experimental
   * Retreat cursor, skipping non-relevant positions, until a relevant stop or
   * BOF is reached. Sets currentIndex and returns the event at the new position.
   *
   * Mirrors the symmetric stepToPreviousEvent.
   */
  stepToPreviousEvent() {
    let prev = this.decrementIndex(this.currentIndex);
    while (isAt(prev) && !this.isStopRelevant(prev)) {
      prev = this.decrementIndex(prev);
    }
    this.currentIndex = prev;
    return this.eventAt(prev);
  }
  // ---------------------------------------------------------------------------
  // Jumps (Slice 4.2)
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Set cursor to `idx` and return the event at that position.
   */
  jumpToIndex(idx) {
    this.currentIndex = idx;
    return this.eventAt(idx);
  }
  /**
   * @experimental
   * Reset cursor to BOF.
   */
  jumpToBeginningOfForm() {
    this.currentIndex = beginningOfForm;
    return this.eventAt(beginningOfForm);
  }
  // ---------------------------------------------------------------------------
  // indexOf (Slice 4.2 / 4.6)
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Walk the form from BOF (relevance-blind) and return the first AtFormIndex
   * whose ref matches `xPath`. Returns endOfForm if not found.
   *
   * Positional xPath (e.g. /data/repeat[1]/q): compared with concrete ref
   * (includes multiplicity). Generic xPath (no predicates): compared with
   * genericized ref (ignores multiplicity).
   *
   * XPath firewall: only parseAbsoluteRef() crosses this boundary — no XPath
   * engine internals are imported.
   */
  indexOf(xPath) {
    const target = parseAbsoluteRef(xPath);
    let walker = this.incrementIndex(beginningOfForm);
    while (isAt(walker)) {
      if (this.refMatchesTarget(walker.ref, target)) return walker;
      walker = this.incrementIndex(walker);
    }
    return endOfForm;
  }
  /**
   * Compare a walker ref against the parsed target ref.
   *
   * Per-level rule (mirrors JavaRosa FormEntryModel.getIndexByReference):
   *   - If the target level has a concrete multiplicity (>= 0): exact match required.
   *   - If the target level has INDEX_UNBOUND (-1): name match only (any multiplicity).
   *
   * This handles mixed refs like /data/repeat[1]/inner1 where repeat[1] is
   * positional but inner1 has no predicate.
   */
  refMatchesTarget(walkerRef, target) {
    if (walkerRef.levels.length !== target.levels.length) return false;
    for (let i = 0; i < target.levels.length; i++) {
      const w = walkerRef.levels[i];
      const t = target.levels[i];
      if (w.name !== t.name) return false;
      if (t.multiplicity >= 0 && w.multiplicity !== t.multiplicity) return false;
    }
    return true;
  }
  // ---------------------------------------------------------------------------
  // Prompt API (Slice 4.5)
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Returns a question wrapper for the element at the given index (defaults to
   * current cursor). Returns null when not at a question position.
   *
   * The returned object exposes:
   *   - getLabelInnerText(): label text with <output> replaced by ${n} placeholders
   *   - getControlType(): the control type string (e.g. 'input', 'select1')
   *
   * R4.5.2: walks FormDefinition.body via resolvePath — O(depth). No XPath eval.
   * R4.5.8: does NOT trigger XPath evaluation or modify InstanceTree.
   */
  getQuestionAtIndex(idx) {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) return null;
    const resolved = this.resolvePath(target.path);
    if (resolved === null || resolved.element.kind !== "question") return null;
    const element = resolved.element;
    const contextRef = resolved.ref;
    const evaluator = this.evaluator;
    return {
      getLabelInnerText() {
        return element.labelInnerText;
      },
      getControlType() {
        return element.controlType;
      },
      getDataType() {
        return element.binding?.dataType ?? null;
      },
      getHintText() {
        return element.hintText ?? null;
      },
      /**
       * Resolves the question label through itext (when driven by
       * <label ref="jr:itext('id')"/>) in the currently active language,
       * falling back to the raw label placeholder template otherwise, then
       * substitutes every <output> placeholder against the current instance
       * data using this question's own context node (repeat-relative
       * outputs resolve per-instance). Evaluated fresh on every read — no
       * caching (JavaRosa FormEntryPrompt#getQuestionText parity).
       * Added in output-label-substitution PR1 (itext-only); extended with
       * substitution in PR3.
       */
      getQuestionText() {
        if (element.labelItextId != null) {
          const resolved2 = evaluator.resolveItextWithOutputs(element.labelItextId);
          if (resolved2 !== null) {
            return evaluator.substituteText(resolved2.text, resolved2.outputs, contextRef);
          }
        }
        return evaluator.substituteText(element.labelInnerText, element.labelOutputs ?? [], contextRef);
      },
      /**
       * Resolves the question hint through itext (when driven by
       * <hint ref="jr:itext('id')"/>) in the currently active language,
       * falling back to the raw hint placeholder template otherwise, then
       * substitutes every <output> placeholder the same way as
       * getQuestionText(). Added in output-label-substitution PR1
       * (itext-only); extended with substitution in PR3.
       */
      getSubstitutedHintText() {
        if (element.hintItextId != null) {
          const resolved2 = evaluator.resolveItextWithOutputs(element.hintItextId);
          if (resolved2 !== null) {
            return evaluator.substituteText(resolved2.text, resolved2.outputs, contextRef);
          }
        }
        return evaluator.substituteText(element.hintInnerText ?? element.hintText ?? null, element.hintOutputs ?? [], contextRef);
      },
      getRangeBounds() {
        if (element.rangeStart === void 0 && element.rangeEnd === void 0 && element.rangeStep === void 0) {
          return null;
        }
        const bounds = {};
        if (element.rangeStart !== void 0) bounds.start = element.rangeStart;
        if (element.rangeEnd !== void 0) bounds.end = element.rangeEnd;
        if (element.rangeStep !== void 0) bounds.step = element.rangeStep;
        return bounds;
      },
      getAppearance() {
        return element.appearance ?? null;
      },
      getMediatype() {
        return element.mediatype ?? null;
      },
      /**
       * Resolve the question label's media reference for the given itext
       * form (e.g. "image", "audio", "video", "big-image") to its raw,
       * unresolved reference string (e.g. "jr://images/map.svg"). Resolving
       * that reference to a loadable URI is a host concern, out of scope
       * for ts-rosa. Returns null when the label has no itext id, or no
       * value for that form exists in any language.
       */
      getLabelMediaUri(form) {
        if (element.labelItextId == null) return null;
        return evaluator.resolveItextMedia(element.labelItextId, form);
      }
    };
  }
  // ---------------------------------------------------------------------------
  // Repeat navigation (Slice 4.4)
  // ---------------------------------------------------------------------------
  /**
   * @experimental
   * Jump to the PROMPT_NEW_REPEAT position for the innermost repeat that
   * contains the current cursor. Sets currentIndex and returns the event.
   *
   * If the cursor is not inside any repeat, this is a no-op (cursor unchanged,
   * returns the current event). Mirrors JavaRosa FormEntryController.jumpToNewRepeatPrompt().
   *
   * Algorithm:
   *   1. Walk the current index's path from leaf to root to find the innermost
   *      level whose element is a repeat.
   *   2. Set the path to that repeat level, with multiplicity incremented by 1
   *      (the next instance slot, which has no instance → PROMPT_NEW_REPEAT).
   *   3. If no repeat ancestor is found, do nothing.
   */
  jumpToNewRepeatPrompt() {
    if (!isAt(this.currentIndex)) return this.eventAt(this.currentIndex);
    const path = this.currentIndex.path;
    let repeatLevel = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      const el = this.elementAt(
        path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }))
      );
      if (el !== null && el.kind === "repeat") {
        repeatLevel = i;
        break;
      }
    }
    if (repeatLevel === -1) {
      return this.eventAt(this.currentIndex);
    }
    const newLevels = [];
    for (let i = 0; i <= repeatLevel; i++) {
      newLevels.push({ elementIndex: path[i].elementIndex, multiplicity: path[i].multiplicity });
    }
    newLevels[repeatLevel].multiplicity += 1;
    const newIndex = this.buildFormIndex(newLevels);
    this.currentIndex = newIndex;
    return this.eventAt(newIndex);
  }
  /**
   * @experimental
   * Enter the nth repeat instance (0-indexed) for the repeat at the current
   * cursor position. Sets currentIndex to the repeat node at multiplicity n
   * and returns the event (REPEAT if instance exists, PROMPT_NEW_REPEAT otherwise).
   *
   * The cursor must already be positioned at or within a repeat node.
   * Mirrors JavaRosa FormEntryController.descendIntoRepeat(int n).
   */
  descendIntoRepeat(n) {
    if (!isAt(this.currentIndex)) return this.eventAt(this.currentIndex);
    const path = this.currentIndex.path;
    for (let i = 0; i < path.length; i++) {
      const el = this.elementAt(
        path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }))
      );
      if (el !== null && el.kind === "repeat") {
        const newLevels = path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
        newLevels[i].multiplicity = n;
        const newIndex = this.buildFormIndex(newLevels);
        this.currentIndex = newIndex;
        return this.eventAt(newIndex);
      }
    }
    return this.eventAt(this.currentIndex);
  }
  /**
   * @experimental
   * Deletes the repeat instance referenced by `idx` (defaults to the current
   * cursor) and returns the FormEntryEvent for the post-removal cursor
   * position. Mirrors JavaRosa FormEntryController.deleteRepeat(FormIndex) /
   * FormDef.deleteRepeat, composed from two existing, unchanged primitives:
   *
   *   1. removeRepeatInstance(tree, ref) — splices the instance and
   *      re-indexes sibling multiplicities (data layer, unchanged).
   *   2. evaluator.triggerRepeatRemoval(genericRef) — re-runs the DAG
   *      cascade so relevant/required/calculate/constraint are recomputed
   *      (unchanged; full-DAG-rerun cost is a known, accepted limitation).
   *
   * No new recomputation logic is introduced.
   *
   * Cursor re-mapping (design decision 3, JavaRosa-pinned): let `m` be the
   * removed instance's multiplicity. The cursor is rebuilt via
   * buildFormIndex + eventAt reclassification in every case, never reused
   * as-is:
   *   (a) cursor was AT or inside the removed instance (multiplicity === m)
   *       -> truncated to the repeat level at multiplicity m (now the
   *       shifted-down sibling, or empty -> PROMPT_NEW_REPEAT).
   *   (b) cursor was in a later sibling (multiplicity > m) -> same logical
   *       node, multiplicity decremented by 1 to track the re-index.
   *   (c) cursor was in an earlier sibling, outside the repeat entirely, or
   *       otherwise unrelated -> unchanged position, ref regenerated fresh.
   *
   * Throws (fail loudly, no silent no-op / soft-result object) when:
   *   - idx is BOF/EOF (not resolvable)
   *   - idx's path has no repeat ancestor
   *   - the resolved repeat's countExpr is non-null (jr:count-bound; count
   *     is engine-controlled, matches JavaRosa/Collect semantics)
   *   - removeRepeatInstance returns null (out-of-range multiplicity / no
   *     backing instance, e.g. a PROMPT_NEW_REPEAT slot)
   * All validation throws happen BEFORE removeRepeatInstance / cascade /
   * cache invalidation are called — no partial mutation on rejection.
   *
   * Zero XPath imports (firewall preserved) — reuses genericize, buildRef,
   * buildFormIndex, elementAt, eventAt already available in this module.
   */
  deleteRepeat(idx) {
    const target = idx ?? this.currentIndex;
    if (!isAt(target)) {
      throw new Error(`deleteRepeat: index is not resolvable: ${target.kind}`);
    }
    const path = target.path;
    let repeatLevel = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      const el = this.elementAt(
        path.slice(0, i + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }))
      );
      if (el !== null && el.kind === "repeat") {
        repeatLevel = i;
        break;
      }
    }
    if (repeatLevel === -1) {
      throw new Error(`deleteRepeat: index does not reference a repeat instance: ${refToString(target.ref)}`);
    }
    const levels = path.slice(0, repeatLevel + 1).map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
    const repeatRef = this.buildRef(levels);
    const repeatElement = this.elementAt(levels);
    if (repeatElement !== null && repeatElement.kind === "repeat" && repeatElement.countExpr != null) {
      throw new Error(`deleteRepeat: repeat is count-bound (jr:count) and cannot be manually deleted: ${refToString(repeatRef)}`);
    }
    const removed = removeRepeatInstance(this.tree, repeatRef);
    if (removed === null) {
      throw new Error(`deleteRepeat: no repeat instance exists at index: ${refToString(repeatRef)}`);
    }
    this.evaluator.triggerRepeatRemoval(genericize(repeatRef));
    this.evaluator.invalidateChoiceCache();
    const removedMultiplicity = levels[levels.length - 1].multiplicity;
    const newIndex = this.remapCursorAfterRemoval(levels, repeatLevel, removedMultiplicity);
    this.currentIndex = newIndex;
    return this.eventAt(newIndex);
  }
  /**
   * Rebuild `this.currentIndex` after a repeat instance removal, per design
   * decision 3 (cases a-d). ALWAYS rebuilds through buildFormIndex (never
   * reuses the old immutable ref) and classifies via eventAt at the call
   * site (deleteRepeat).
   */
  remapCursorAfterRemoval(removedAncestorLevels, repeatLevel, removedMultiplicity) {
    if (!isAt(this.currentIndex)) {
      return this.currentIndex;
    }
    const curPath = this.currentIndex.path;
    const sameFamily = curPath.length > repeatLevel && this.pathPrefixMatches(curPath, removedAncestorLevels, repeatLevel) && curPath[repeatLevel].elementIndex === removedAncestorLevels[repeatLevel].elementIndex;
    if (!sameFamily) {
      const unchangedLevels2 = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
      return this.buildFormIndex(unchangedLevels2);
    }
    const curMultiplicity = curPath[repeatLevel].multiplicity;
    if (curMultiplicity === removedMultiplicity) {
      return this.buildFormIndex(removedAncestorLevels.map((l) => ({ ...l })));
    }
    if (curMultiplicity > removedMultiplicity) {
      const shiftedLevels = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
      shiftedLevels[repeatLevel].multiplicity -= 1;
      return this.buildFormIndex(shiftedLevels);
    }
    const unchangedLevels = curPath.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity }));
    return this.buildFormIndex(unchangedLevels);
  }
  /** Returns true when curPath[0..upTo-1] equals ancestorLevels[0..upTo-1] (elementIndex + multiplicity). */
  pathPrefixMatches(curPath, ancestorLevels, upTo) {
    for (let i = 0; i < upTo; i++) {
      if (curPath[i].elementIndex !== ancestorLevels[i].elementIndex || curPath[i].multiplicity !== ancestorLevels[i].multiplicity) {
        return false;
      }
    }
    return true;
  }
  // ---------------------------------------------------------------------------
  // Internal: resolvePath — O(depth) walk of FormDefinition.body
  // ---------------------------------------------------------------------------
  /**
   * Walk FormDefinition.body using the path levels to find the leaf element.
   * Also reconstructs the concrete TreeReference (used for classifying repeats,
   * relevance checks, and element lookup).
   *
   * Returns null only when the path is structurally invalid (should not happen
   * with well-formed FormIndex values produced by incrementIndex).
   */
  resolvePath(path) {
    if (path.length === 0) return null;
    let siblings2 = this.definition.body;
    const parentChain = [];
    let element;
    const rootName = this.definition.mainInstance.root.name;
    let ref = parseAbsoluteRef(`/${rootName}`);
    for (let i = 0; i < path.length; i++) {
      const lvl = path[i];
      element = siblings2[lvl.elementIndex];
      if (element === void 0) return null;
      const leafName = this.elementLeafName(element);
      ref = extendRef(ref, leafName, lvl.multiplicity);
      if (i < path.length - 1) {
        if (element.kind !== "group" && element.kind !== "repeat") return null;
        parentChain.push(element);
        siblings2 = element.children;
      }
    }
    if (element === void 0) return null;
    return { element, parentChain, ref };
  }
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------
  /**
   * Extract the last segment name from a FormElement's TreeReference.
   * This is the element's own local name in the body/instance tree.
   */
  elementLeafName(element) {
    const levels = element.ref.levels;
    if (levels.length === 0) return "unknown";
    return levels[levels.length - 1].name;
  }
  /**
   * Get the element at the given mutable levels array (leaf element).
   * Returns null if path is invalid.
   */
  elementAt(levels) {
    if (levels.length === 0) return null;
    const resolved = this.resolvePath(levels.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })));
    return resolved?.element ?? null;
  }
  /**
   * Get the children array for the element at `levels`, or body if levels is empty.
   */
  childrenOf(levels) {
    if (levels.length === 0) return this.definition.body;
    const el = this.elementAt(levels);
    if (el === null) return [];
    if (el.kind === "group" || el.kind === "repeat") return el.children;
    return [];
  }
  /**
   * Build the concrete ref for the element at the given mutable levels array.
   *
   * Multiplicity is applied ONLY for repeat elements (concrete instance
   * position). For questions and groups the multiplicity in the path is
   * always 0 (by algorithm), so we use INDEX_UNBOUND there — keeping the
   * ref in the same form as the binding key (refToString generic) that
   * FormEvaluator uses for constraint / relevance lookups.
   *
   * For repeat elements the concrete multiplicity IS carried (needed for
   * resolveReference instance-existence checks and per-instance relevance).
   */
  buildRef(levels) {
    const rootName = this.definition.mainInstance.root.name;
    let ref = parseAbsoluteRef(`/${rootName}`);
    let siblings2 = this.definition.body;
    for (const lvl of levels) {
      const el = siblings2[lvl.elementIndex];
      if (el === void 0) break;
      const name2 = this.elementLeafName(el);
      const mult = el.kind === "repeat" ? lvl.multiplicity : void 0;
      ref = extendRef(ref, name2, mult);
      if (el.kind === "group" || el.kind === "repeat") {
        siblings2 = el.children;
      }
    }
    return ref;
  }
  /**
   * Convert mutable levels array to an immutable AtFormIndex.
   */
  buildFormIndex(levels) {
    if (levels.length === 0) return endOfForm;
    const ref = this.buildRef(levels);
    return atIndex(
      levels.map((l) => ({ elementIndex: l.elementIndex, multiplicity: l.multiplicity })),
      ref
    );
  }
  /**
   * Ported from FormEntryModel.incrementHelper (LINEAR mode, java:548-642).
   * Mutates `levels` in place to advance to the next position.
   */
  incrementHelper(levels, descend) {
    let i = levels.length - 1;
    let exitRepeat = false;
    const leafEl = i >= 0 ? this.elementAt(levels) : null;
    if (i === -1 || leafEl !== null && (leafEl.kind === "group" || leafEl.kind === "repeat")) {
      if (i >= 0 && leafEl !== null && leafEl.kind === "repeat") {
        const currentRef = this.buildRef(levels);
        if (resolveReference(this.tree, currentRef) === null) {
          descend = false;
          exitRepeat = true;
        }
      }
      if (descend) {
        const container = this.childrenOf(levels);
        if (i === -1 || container.length > 0) {
          levels.push({ elementIndex: 0, multiplicity: 0 });
          return;
        }
      }
    }
    while (i >= 0) {
      const el = this.elementAt(levels.slice(0, i + 1));
      if (!exitRepeat && el !== null && el.kind === "repeat") {
        levels[i].multiplicity += 1;
        return;
      }
      const parentSiblings = i === 0 ? this.definition.body : this.childrenOf(levels.slice(0, i));
      const curElementIndex = levels[i].elementIndex;
      if (curElementIndex + 1 >= parentSiblings.length) {
        levels.pop();
        i--;
        exitRepeat = false;
      } else {
        levels[i].elementIndex = curElementIndex + 1;
        levels[i].multiplicity = 0;
        return;
      }
    }
  }
  /**
   * Ported from FormEntryModel.decrementHelper (LINEAR mode, java:672-719).
   * Mutates `levels` in place to retreat to the previous position.
   */
  decrementHelper(levels) {
    let i = levels.length - 1;
    if (i !== -1) {
      const curIndex = levels[i].elementIndex;
      const curMult = levels[i].multiplicity;
      const curEl = this.elementAt(levels);
      if (curEl !== null && curEl.kind === "repeat" && curMult > 0) {
        levels[i].multiplicity = curMult - 1;
      } else if (curIndex > 0) {
        levels[i].elementIndex = curIndex - 1;
        levels[i].multiplicity = 0;
        if (this.setRepeatNextMultiplicity(levels)) return;
      } else {
        levels.pop();
        return;
      }
    }
    let el = i < 0 ? null : this.elementAt(levels);
    while (el === null || el.kind !== "question") {
      const children = this.childrenOf(levels);
      if (children.length === 0) {
        return;
      }
      const subIndex = children.length - 1;
      levels.push({ elementIndex: subIndex, multiplicity: 0 });
      if (this.setRepeatNextMultiplicity(levels)) return;
      el = this.elementAt(levels);
    }
  }
  /**
   * Ported from FormEntryModel.setRepeatNextMultiplicity (LINEAR mode, java:721-742).
   *
   * If the leaf element in `levels` is a repeat, count existing instances and
   * set multiplicity to `count - 1` (last instance) if instances exist, or 0
   * (which will yield PROMPT_NEW_REPEAT) if none.
   *
   * Returns true if the leaf is a repeat (multiplicity was set), false otherwise.
   */
  setRepeatNextMultiplicity(levels) {
    const leafEl = this.elementAt(levels);
    if (leafEl === null || leafEl.kind !== "repeat") return false;
    const leafRef = this.buildRef(levels);
    const genericRef = genericize(leafRef);
    const count2 = countRepeatInstances(this.tree, genericRef);
    if (count2 > 0) {
      levels[levels.length - 1].multiplicity = count2 - 1;
    } else {
      levels[levels.length - 1].multiplicity = 0;
    }
    return true;
  }
};

// src/model/instance/InstanceSerializer.ts
function serializeInstance(tree, opts) {
  const isRelevant = opts?.isRelevant ?? (() => true);
  return serializeNode(tree.root, isRelevant) ?? "";
}
function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function serializeAttrs(attrs) {
  if (attrs === null || attrs.size === 0) return "";
  const parts = [];
  for (const [key, val] of attrs) {
    parts.push(` ${key}="${escapeAttr(val)}"`);
  }
  return parts.join("");
}
function serializeNode(node, isRelevant) {
  if (node.multiplicity === INDEX_TEMPLATE) return null;
  if (!isRelevant(node)) return null;
  const attrs = serializeAttrs(node.attributes);
  if (node.children.length === 0) {
    if (node.value === null) {
      return `<${node.name}${attrs}/>`;
    }
    const text = escapeText(uncast(node.value));
    if (text === "") {
      return `<${node.name}${attrs}/>`;
    }
    return `<${node.name}${attrs}>${text}</${node.name}>`;
  }
  const seenNames = /* @__PURE__ */ new Set();
  const orderedNames = [];
  for (const child of node.children) {
    if (!seenNames.has(child.name)) {
      seenNames.add(child.name);
      orderedNames.push(child.name);
    }
  }
  let childContent = "";
  for (const childName of orderedNames) {
    for (const child of node.children) {
      if (child.name !== childName) continue;
      const serialized = serializeNode(child, isRelevant);
      if (serialized !== null) {
        childContent += serialized;
      }
    }
  }
  return `<${node.name}${attrs}>${childContent}</${node.name}>`;
}

// src/session/PreloadProvider.ts
function pureJsUuidV4() {
  const nibbles = [];
  for (let i = 0; i < 32; i++) {
    nibbles.push(Math.floor(Math.random() * 16).toString(16));
  }
  nibbles[12] = "4";
  nibbles[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  const h = nibbles.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
var defaultPreloadProvider = {
  now: () => /* @__PURE__ */ new Date(),
  uid: () => pureJsUuidV4(),
  property: () => null
};
var FROZEN_DEFAULT_DATE = /* @__PURE__ */ new Date("2020-01-01T00:00:00.000Z");
var FROZEN_DEFAULT_UID = "00000000-0000-4000-8000-000000000000";
function frozenPreloadProvider(opts) {
  const fixedNow = opts?.now ?? FROZEN_DEFAULT_DATE;
  const fixedUid = opts?.uid ?? FROZEN_DEFAULT_UID;
  const props = opts?.properties ?? {};
  return {
    now: () => fixedNow,
    uid: () => fixedUid,
    property: (name2) => props[name2] ?? null
  };
}

// src/util/DateUtils.ts
var DAY_IN_MS = 24 * 60 * 60 * 1e3;
var DOW_MAP = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};
function getPastPeriodDate(ref, type, start, beginning, includeToday, nAgo) {
  if (type === "week") {
    const target_dow = DOW_MAP[start];
    if (target_dow === void 0) {
      throw new Error(`getPastPeriodDate: invalid start day: ${start}`);
    }
    const offset = includeToday ? 1 : 0;
    const current_dow = ref.getUTCDay();
    const diff = (current_dow - target_dow + (7 + offset)) % 7 - offset + 7 * nAgo - (beginning ? 0 : 6);
    return new Date(ref.getTime() - diff * DAY_IN_MS);
  } else if (type === "month") {
    throw new Error("getPastPeriodDate: month period type is not supported");
  } else {
    throw new Error(`getPastPeriodDate: unsupported period type: ${type}`);
  }
}

// src/session/preload/resolvePreload.ts
function formatUtcDate2(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function resolvePrevperiod(params, provider) {
  const rest = params.slice("prevperiod-".length);
  const parts = rest.split("-");
  if (parts.length < 3) {
    throw new Error(`invalid preload params for preload mode 'date': ${params}`);
  }
  const type = parts[0];
  const start = parts[1];
  const headOrTail = parts[2];
  let beginning;
  if (headOrTail === "head") {
    beginning = true;
  } else if (headOrTail === "tail") {
    beginning = false;
  } else {
    throw new Error(`invalid preload params for preload mode 'date': ${params}`);
  }
  let includeToday = false;
  if (parts.length >= 4) {
    const inc = parts[3];
    if (inc === "x") {
      includeToday = true;
    } else if (inc === "") {
      includeToday = false;
    } else {
      throw new Error(`invalid preload params for preload mode 'date': ${params}`);
    }
  }
  let nAgo = 1;
  if (parts.length >= 5) {
    const n = parseInt(parts[4], 10);
    if (Number.isNaN(n)) {
      throw new Error(`invalid preload params for preload mode 'date': ${params}`);
    }
    nAgo = n;
  }
  const d = getPastPeriodDate(provider.now(), type, start, beginning, includeToday, nAgo);
  return formatUtcDate2(d);
}
function resolvePreload(type, params, provider) {
  switch (type) {
    case "date": {
      const p = params ?? "";
      if (p === "today") {
        return formatUtcDate2(provider.now());
      } else if (p.startsWith("prevperiod-")) {
        return resolvePrevperiod(p, provider);
      } else {
        throw new Error(`invalid preload params for preload mode 'date': ${p}`);
      }
    }
    case "timestamp": {
      if (params === "start") {
        return provider.now().toISOString();
      }
      if (params === "end") {
        return provider.now().toISOString();
      }
      return null;
    }
    case "uid": {
      return `uuid:${provider.uid()}`;
    }
    case "property": {
      if (params === null) return null;
      return provider.property(params);
    }
    default:
      throw new Error(`unsupported jr:preload type: ${type}`);
  }
}

// src/session/preload/applyPreloads.ts
function applyPreloadsToNode(node, provider) {
  if (node.multiplicity === INDEX_TEMPLATE) {
    return;
  }
  if (node.preload != null) {
    const raw = resolvePreload(node.preload, node.preloadParams ?? null, provider);
    if (raw !== null) {
      const answer = cast(node.dataType, raw);
      node.value = answer ?? null;
    }
  }
  for (const child of node.children) {
    applyPreloadsToNode(child, provider);
  }
}
function applyPreloads(tree, provider) {
  applyPreloadsToNode(tree.root, provider);
}
function applyEndPreloadsToNode(node, provider) {
  if (node.multiplicity === INDEX_TEMPLATE) {
    return;
  }
  if (node.preload === "timestamp" && node.preloadParams === "end") {
    const raw = resolvePreload(node.preload, node.preloadParams, provider);
    if (raw !== null) {
      node.value = cast(node.dataType, raw) ?? null;
    }
  }
  for (const child of node.children) {
    applyEndPreloadsToNode(child, provider);
  }
}
function applyEndPreloads(tree, provider) {
  applyEndPreloadsToNode(tree.root, provider);
}

// src/model/instance/InstanceHydrator.ts
var HydrationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "HydrationError";
  }
};
function hydrateInstance(definition, instanceXml) {
  const doc = getXmlParser().parse(instanceXml);
  const dataRootEl = firstElementChild(doc);
  if (dataRootEl === null) {
    throw new HydrationError("hydration failed: submission XML has no root element");
  }
  const workingRoot = cloneNode(definition.mainInstance.root);
  if (workingRoot.name !== dataRootEl.localName) {
    throw new HydrationError(
      `hydration root mismatch: expected <${workingRoot.name}>, got <${dataRootEl.localName}>`
    );
  }
  copyAttributes(workingRoot, dataRootEl);
  hydrateNode(workingRoot, dataRootEl, `/${workingRoot.name}`);
  return { root: workingRoot, name: definition.mainInstance.name };
}
function firstElementChild(doc) {
  const children = doc.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      return child;
    }
  }
  return null;
}
function copyAttributes(node, el) {
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && !attr.name.startsWith("xmlns")) {
      setAttribute(node, attr.name, attr.value);
    }
  }
}
function hydrateNode(templateNode, xmlEl, path) {
  const repeatTemplateNames = /* @__PURE__ */ new Set();
  const nonRepeatChildren = [];
  for (const child of templateNode.children) {
    if (child.multiplicity === INDEX_TEMPLATE) {
      repeatTemplateNames.add(child.name);
    } else {
      nonRepeatChildren.push(child);
    }
  }
  const definedNames = /* @__PURE__ */ new Set([
    ...repeatTemplateNames,
    ...nonRepeatChildren.map((c) => c.name)
  ]);
  for (const t of nonRepeatChildren) {
    const childPath = `${path}/${t.name}`;
    const matches = childElementsByLocalName(xmlEl, t.name);
    if (matches.length === 0) {
      continue;
    }
    if (matches.length > 1) {
      throw new HydrationError(
        `multiple <${t.name}> elements at ${childPath} but definition declares it non-repeating`
      );
    }
    const match = matches[0];
    copyAttributes(t, match);
    if (t.children.length === 0) {
      const raw = directTextContent(match);
      if (raw === null) {
        t.value = null;
      } else {
        const value = cast(t.dataType, raw);
        if (value === null) {
          throw new HydrationError(`cannot cast "${raw}" to ${t.dataType} at ${childPath}`);
        }
        t.value = value;
      }
    } else {
      hydrateNode(t, match, childPath);
    }
  }
  for (const name2 of repeatTemplateNames) {
    const tt = templateNode.children.find(
      (c) => c.name === name2 && c.multiplicity === INDEX_TEMPLATE
    );
    if (tt === void 0) continue;
    const instances = childElementsByLocalName(xmlEl, name2);
    const childPath = `${path}/${name2}`;
    for (let i = 0; i < instances.length; i++) {
      const xmlInstance = instances[i];
      const clone = cloneNode(tt);
      clone.multiplicity = i;
      clone.parent = templateNode;
      templateNode.children.push(clone);
      copyAttributes(clone, xmlInstance);
      hydrateNode(clone, xmlInstance, `${childPath}[${i + 1}]`);
    }
  }
  const xmlChildren = childElementsByLocalName(xmlEl, "*");
  for (const el of xmlChildren) {
    const name2 = el.localName ?? "";
    if (!definedNames.has(name2)) {
      throw new HydrationError(
        `unknown node in submission XML not present in form definition: ${path}/${name2}`
      );
    }
  }
}

// src/eval/ActionRegistry.ts
function buildActionRegistry(actions) {
  const loadActions = [];
  const valueChangedByTrigger = /* @__PURE__ */ new Map();
  const byEvent = /* @__PURE__ */ new Map();
  const newRepeatByScope = /* @__PURE__ */ new Map();
  for (const action of actions) {
    let eventBucket = byEvent.get(action.event);
    if (eventBucket === void 0) {
      eventBucket = [];
      byEvent.set(action.event, eventBucket);
    }
    eventBucket.push(action);
    if (action.event === "odk-new-repeat" && action.hostRef !== null) {
      const scopeKey = refToString(genericize(action.hostRef));
      let scopeBucket = newRepeatByScope.get(scopeKey);
      if (scopeBucket === void 0) {
        scopeBucket = [];
        newRepeatByScope.set(scopeKey, scopeBucket);
      }
      scopeBucket.push(action);
    }
    if (action.event === "odk-instance-first-load") {
      loadActions.push(action);
      continue;
    }
    if (action.event === "xforms-value-changed") {
      for (const trigger of action.triggers) {
        const key = refToString(genericize(trigger));
        let bucket = valueChangedByTrigger.get(key);
        if (bucket === void 0) {
          bucket = [];
          valueChangedByTrigger.set(key, bucket);
        }
        bucket.push(action);
      }
    }
  }
  return { loadActions, valueChangedByTrigger, byEvent, newRepeatByScope };
}

// src/session/FormSession.ts
function createFormSession(definition, opts) {
  for (const id2 of definition.externalInstances.keys()) {
    if (!definition.secondaryInstances.has(id2)) {
      throw new Error(
        `createFormSession: external instance '${id2}' is declared but not resolved. Call resolveExternalInstances(definition) before createFormSession().`
      );
    }
  }
  const provider = opts?.preloadProvider ?? defaultPreloadProvider;
  const tree = opts?.instanceXml !== void 0 ? hydrateInstance(definition, opts.instanceXml) : definition.mainInstance;
  const evaluator = new FormEvaluator(tree, {
    itext: definition.itext ?? null,
    secondaryInstances: definition.secondaryInstances,
    body: definition.body
  });
  if (opts?.instanceXml === void 0) {
    applyPreloads(tree, provider);
  }
  if (definition.dag !== null) {
    evaluator.initializeInstance(definition.dag, definition.constraintBindings);
  }
  const actionRegistry = buildActionRegistry(definition.actions);
  evaluator.setActionRegistry(actionRegistry);
  evaluator.fireLoadActions();
  const navigator = new FormNavigator(definition, tree, evaluator);
  return {
    definition,
    tree,
    evaluator,
    navigator,
    serializeToXml: () => serializeInstance(tree, {
      isRelevant: (node) => evaluator.isNodeRelevant(node)
    }),
    finalize: () => {
      evaluator.fireRevalidateActions();
      applyEndPreloads(tree, provider);
      if (definition.dag !== null) {
        evaluator.initializeInstance(definition.dag, definition.constraintBindings);
      }
    }
  };
}

// src/platform/ExternalInstanceResolver.ts
var _provider2 = null;
function registerExternalInstanceResolver(provider) {
  _provider2 = provider;
}
function getExternalInstanceResolver() {
  if (_provider2 === null) {
    throw new Error(
      "ExternalInstanceResolver provider is not registered. Call registerExternalInstanceResolver() before resolving external instances. In tests, wire the provider in tests/setup.ts via setupFiles."
    );
  }
  return _provider2;
}

// src/parse/csv/parseCsv.ts
var BOM = "\uFEFF";
function parseCsv(text) {
  const src = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  if (src.length === 0) return [];
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  let sawAnyFieldOnLine = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAnyFieldOnLine = false;
  };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      sawAnyFieldOnLine = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      sawAnyFieldOnLine = true;
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (src[i + 1] === "\n") {
        endRow();
        i += 2;
        continue;
      }
      endRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }
    sawAnyFieldOnLine = true;
    field += ch;
    i += 1;
  }
  if (inQuotes) {
    throw new Error("parseCsv: unterminated quoted field");
  }
  if (field.length > 0 || sawAnyFieldOnLine || row.length > 0) {
    endRow();
  }
  return rows;
}

// src/parse/csv/csvToInstanceTree.ts
function csvToInstanceTree(id2, csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error(`csvToInstanceTree: CSV for instance '${id2}' is empty`);
  }
  const [header, ...dataRows] = rows;
  const columns = header;
  const root = newNode("root");
  dataRows.forEach((row, rowIndex) => {
    if (row.length !== columns.length) {
      throw new Error(
        `csvToInstanceTree: CSV for instance '${id2}' has a column count mismatch at row ${rowIndex + 2} (header has ${columns.length} column(s), row has ${row.length})`
      );
    }
    const item = newNode("item", { multiplicity: rowIndex });
    item.parent = root;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const columnName = columns[colIndex];
      const cell = row[colIndex];
      const col = newNode(columnName, { value: cast("string", cell) ?? null });
      appendChild(item, col);
    }
    root.children.push(item);
  });
  return { root, name: id2 };
}

// src/parse/resolveExternalInstances.ts
var LAST_SAVED_SRC = "jr://instance/last-saved";
function isXmlSrc(src) {
  return src.toLowerCase().endsWith(".xml");
}
async function resolveExternalInstances(definition) {
  if (definition.externalInstances.size === 0) {
    return definition;
  }
  const resolver = getExternalInstanceResolver();
  const merged = new Map(definition.secondaryInstances);
  for (const [id2, { src }] of definition.externalInstances) {
    let raw;
    try {
      raw = await resolver.resolve(src);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: failed to resolve external instance '${id2}' (${src}): ${String(cause)}`
      );
    }
    if (src === LAST_SAVED_SRC) {
      merged.set(id2, buildLastSavedTree(id2, src, raw, definition));
      continue;
    }
    if (isXmlSrc(src)) {
      if (raw === null) {
        throw new Error(
          `resolveExternalInstances: external instance '${id2}' (${src}) has malformed external XML: resolver returned null`
        );
      }
      merged.set(id2, xmlTextToInstanceTree(id2, src, raw, "external XML"));
      continue;
    }
    if (raw === null) {
      throw new Error(
        `resolveExternalInstances: external instance '${id2}' (${src}) has malformed CSV: resolver returned null`
      );
    }
    let tree;
    try {
      tree = csvToInstanceTree(id2, raw);
    } catch (cause) {
      throw new Error(
        `resolveExternalInstances: external instance '${id2}' (${src}) has malformed CSV: ${String(cause)}`
      );
    }
    merged.set(id2, tree);
  }
  return { ...definition, secondaryInstances: merged };
}
function buildLastSavedTree(id2, src, raw, definition) {
  if (raw === null) {
    const tree = { root: newNode(definition.mainInstance.root.name), name: id2 };
    applyBindings(tree, /* @__PURE__ */ new Map());
    return tree;
  }
  return xmlTextToInstanceTree(id2, src, raw, "last-saved XML");
}
function xmlTextToInstanceTree(id2, src, raw, kind) {
  let documentElement;
  try {
    documentElement = getXmlParser().parse(raw).documentElement;
  } catch (cause) {
    throw new Error(
      `resolveExternalInstances: external instance '${id2}' (${src}) has malformed ${kind}: ${String(cause)}`
    );
  }
  if (documentElement === null || documentElement === void 0) {
    throw new Error(
      `resolveExternalInstances: external instance '${id2}' (${src}) has malformed ${kind}: no root element`
    );
  }
  const tree = { root: buildInstanceNode(documentElement), name: id2 };
  applyBindings(tree, /* @__PURE__ */ new Map());
  return tree;
}

exports.AnswerResult = AnswerResult;
exports.DEFAULT_MULTIPLICITY = DEFAULT_MULTIPLICITY;
exports.FORM_ENTRY_EVENT = FORM_ENTRY_EVENT;
exports.FormEvaluator = FormEvaluator;
exports.FormNavigator = FormNavigator;
exports.HydrationError = HydrationError;
exports.INDEX_ATTRIBUTE = INDEX_ATTRIBUTE;
exports.INDEX_TEMPLATE = INDEX_TEMPLATE;
exports.INDEX_UNBOUND = INDEX_UNBOUND;
exports.REF_ABSOLUTE = REF_ABSOLUTE;
exports.addRepeatInstance = addRepeatInstance;
exports.appendChild = appendChild;
exports.atIndex = atIndex;
exports.attributeNames = attributeNames;
exports.beginningOfForm = beginningOfForm;
exports.booleanValue = booleanValue;
exports.cast = cast;
exports.childrenNamed = childrenNamed;
exports.cloneNode = cloneNode;
exports.contextualize = contextualize;
exports.controlTypeFromTag = controlTypeFromTag;
exports.countRepeatInstances = countRepeatInstances;
exports.createFormSession = createFormSession;
exports.dataTypeFromXsdName = dataTypeFromXsdName;
exports.dateValue = dateValue;
exports.decimalValue = decimalValue;
exports.defaultPreloadProvider = defaultPreloadProvider;
exports.deleteAttribute = deleteAttribute;
exports.endOfForm = endOfForm;
exports.extendRef = extendRef;
exports.frozenPreloadProvider = frozenPreloadProvider;
exports.genericize = genericize;
exports.getAttribute = getAttribute;
exports.getExternalInstanceResolver = getExternalInstanceResolver;
exports.getXmlParser = getXmlParser;
exports.hydrateInstance = hydrateInstance;
exports.intValue = intValue;
exports.isAt = isAt;
exports.isBof = isBof;
exports.isEof = isEof;
exports.level = level;
exports.newNode = newNode;
exports.nthRealChildNamed = nthRealChildNamed;
exports.parentOf = parentOf;
exports.parseAbsoluteRef = parseAbsoluteRef;
exports.parseDocument = parseDocument;
exports.parseForm = parseForm;
exports.realChildrenNamed = realChildrenNamed;
exports.refEquals = refEquals;
exports.refToString = refToString;
exports.registerExternalInstanceResolver = registerExternalInstanceResolver;
exports.registerXmlParser = registerXmlParser;
exports.removeRepeatInstance = removeRepeatInstance;
exports.resolveAll = resolveAll;
exports.resolveAllContextualized = resolveAllContextualized;
exports.resolveAllWithin = resolveAllWithin;
exports.resolveExternalInstances = resolveExternalInstances;
exports.resolveReference = resolveReference;
exports.rootRef = rootRef;
exports.selectMultiValue = selectMultiValue;
exports.selectOneValue = selectOneValue;
exports.selfRef = selfRef;
exports.setAttribute = setAttribute;
exports.stringValue = stringValue;
exports.uncast = uncast;
exports.walkControls = walkControls;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map