/**
 * XFormsElement — pure string-builder DSL for authoring XForms definitions.
 *
 * Mirrors the JavaRosa XFormsElement + BindBuilderXFormsElement API exactly:
 * factory method names, call signatures, and asXml() output format are
 * intentionally identical so ported test code requires zero mechanical rename.
 *
 * This module has NO dependency on any engine code; it lives in tests/harness/
 * and is a devDependency-only artifact.
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface XFormsElement {
  getName(): string;
  asXml(): string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAttributesString(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`)
    .join(" ");
}

/** Parse "tagName attr1=\"v1\" attr2=\"v2\"" into [name, attributes]. */
function parseNameAndAttributes(raw: string): [string, Record<string, string>] {
  if (!raw.includes(" ")) {
    return [raw, {}];
  }

  const name = raw.split(" ")[0] ?? raw;
  const attrs: Record<string, string> = {};

  // Split on spaces that are NOT inside double-quoted values.
  const spaceOutsideQuotes = / (?=(?:[^"]*"[^"]*")*[^"]*$)/g;
  const words = raw.split(spaceOutsideQuotes).slice(1);

  for (const word of words) {
    // Split on first = not preceded by ) and followed by " or '
    const match = word.match(/^([^=]+)=["'](.*)["']$/s);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      attrs[match[1]] = match[2];
    }
  }

  return [name, attrs];
}

// ---------------------------------------------------------------------------
// Concrete element types (internal — not exported)
// ---------------------------------------------------------------------------

class EmptyXFormsElement implements XFormsElement {
  constructor(
    private readonly name: string,
    private readonly attributes: Record<string, string>
  ) {}

  getName(): string {
    return this.name;
  }

  asXml(): string {
    const attrsStr = buildAttributesString(this.attributes);
    return `<${this.name}${attrsStr ? " " + attrsStr : ""}/>`;
  }
}

class TagXFormsElement implements XFormsElement {
  constructor(
    private readonly name: string,
    private readonly attributes: Record<string, string>,
    private readonly children: XFormsElement[]
  ) {}

  getName(): string {
    return this.name;
  }

  asXml(): string {
    const attrsStr = buildAttributesString(this.attributes);
    const childrenXml = this.children.map((c) => c.asXml()).join("");
    const decl = this.name === "h:html" ? '<?xml version="1.0"?>' : "";
    return `${decl}<${this.name}${attrsStr ? " " + attrsStr : ""}>${childrenXml}</${this.name}>`;
  }
}

class StringLiteralXFormsElement implements XFormsElement {
  constructor(
    private readonly name: string,
    private readonly attributes: Record<string, string>,
    private readonly innerHtml: string
  ) {}

  getName(): string {
    return this.name;
  }

  asXml(): string {
    const attrsStr = buildAttributesString(this.attributes);
    return `<${this.name}${attrsStr ? " " + attrsStr : ""}>${this.innerHtml}</${this.name}>`;
  }
}

// ---------------------------------------------------------------------------
// BindBuilderXFormsElement (exported for fluent bind usage)
// ---------------------------------------------------------------------------

export class BindBuilderXFormsElement implements XFormsElement {
  private readonly attributes: Record<string, string>;

  private constructor(nodeset: string) {
    this.attributes = { nodeset };
  }

  static create(nodeset: string): BindBuilderXFormsElement {
    return new BindBuilderXFormsElement(nodeset);
  }

  getNodeset(): string {
    return this.attributes["nodeset"] ?? "";
  }

  getName(): string {
    return "bind";
  }

  type(typeValue: string): this {
    this.attributes["type"] = typeValue;
    return this;
  }

  constraint(expression: string): this {
    this.attributes["constraint"] = expression;
    return this;
  }

  required(): this;
  required(expression: string): this;
  required(expression?: string): this {
    this.attributes["required"] = expression ?? "true()";
    return this;
  }

  relevant(expression: string): this {
    this.attributes["relevant"] = expression;
    return this;
  }

  calculate(expression: string): this {
    this.attributes["calculate"] = expression;
    return this;
  }

  preload(expression: string): this {
    this.attributes["jr:preload"] = expression;
    return this;
  }

  readonly(): this;
  readonly(expression: string): this;
  readonly(expression?: string): this {
    this.attributes["readonly"] = expression ?? "true()";
    return this;
  }

  withAttribute(namespace: string, name: string, expression: string): this {
    this.attributes[`${namespace}:${name}`] = expression;
    return this;
  }

  asXml(): string {
    return new EmptyXFormsElement("bind", this.attributes).asXml();
  }
}

// ---------------------------------------------------------------------------
// Typed wrappers for head/body (mirror JavaRosa's inner classes)
// ---------------------------------------------------------------------------

export class HeadXFormsElement extends TagXFormsElement {
  constructor(children: XFormsElement[]) {
    super("h:head", {}, children);
  }
}

export class BodyXFormsElement extends TagXFormsElement {
  constructor(children: XFormsElement[]) {
    super("h:body", {}, children);
  }
}

// ---------------------------------------------------------------------------
// Factory functions — mirror JavaRosa static methods exactly
// ---------------------------------------------------------------------------

/**
 * Generic element factory. Two overloads:
 *   t(name, ...children) — children elements
 *   t(name, innerHtml)   — string content
 */
export function t(name: string, innerHtml: string): XFormsElement;
export function t(name: string, ...children: XFormsElement[]): XFormsElement;
export function t(
  name: string,
  ...args: (string | XFormsElement)[]
): XFormsElement {
  const [tagName, attrs] = parseNameAndAttributes(name);

  if (args.length === 0) {
    return new EmptyXFormsElement(tagName, attrs);
  }

  if (args.length === 1 && typeof args[0] === "string") {
    return new StringLiteralXFormsElement(tagName, attrs, args[0]);
  }

  const children = args as XFormsElement[];
  return new TagXFormsElement(tagName, attrs, children);
}

export function html(
  headEl: HeadXFormsElement,
  bodyEl: BodyXFormsElement
): XFormsElement {
  return t(
    'h:html ' +
      'xmlns="http://www.w3.org/2002/xforms" ' +
      'xmlns:h="http://www.w3.org/1999/xhtml" ' +
      'xmlns:jr="http://openrosa.org/javarosa" ' +
      'xmlns:odk="http://www.opendatakit.org/xforms" ' +
      'xmlns:orx="http://openrosa.org/xforms"',
    headEl,
    bodyEl
  );
}

export function head(...children: XFormsElement[]): HeadXFormsElement {
  return new HeadXFormsElement(children);
}

export function body(...children: XFormsElement[]): BodyXFormsElement {
  return new BodyXFormsElement(children);
}

export function title(innerHTML: string): XFormsElement {
  return new StringLiteralXFormsElement("h:title", {}, innerHTML);
}

export function model(...children: XFormsElement[]): XFormsElement {
  return t("model", ...children);
}

export function mainInstance(...children: XFormsElement[]): XFormsElement {
  return t("instance", ...children);
}

export function instance(name: string, ...children: XFormsElement[]): XFormsElement {
  return t(`instance id="${name}"`, t("root", ...children));
}

export function bind(nodeset: string): BindBuilderXFormsElement {
  return BindBuilderXFormsElement.create(nodeset);
}

export function input(ref: string, ...children: XFormsElement[]): XFormsElement {
  if (children.length === 0) {
    return new EmptyXFormsElement("input", { ref });
  }
  return new TagXFormsElement("input", { ref }, children);
}

export function select1(ref: string, ...children: XFormsElement[]): XFormsElement {
  if (children.length === 0) {
    return new EmptyXFormsElement("select1", { ref });
  }
  return new TagXFormsElement("select1", { ref }, children);
}

export function select(ref: string, ...children: XFormsElement[]): XFormsElement {
  if (children.length === 0) {
    return new EmptyXFormsElement("select", { ref });
  }
  return new TagXFormsElement("select", { ref }, children);
}

export function repeat(ref: string, ...children: XFormsElement[]): XFormsElement {
  if (children.length === 0) {
    return new EmptyXFormsElement("repeat", { nodeset: ref });
  }
  return new TagXFormsElement("repeat", { nodeset: ref }, children);
}

export function group(ref: string, ...children: XFormsElement[]): XFormsElement {
  if (children.length === 0) {
    return new EmptyXFormsElement("group", { ref });
  }
  return new TagXFormsElement("group", { ref }, children);
}

export function label(innerHtml: string): XFormsElement {
  return new StringLiteralXFormsElement("label", {}, innerHtml);
}

export function item(value: string | number, labelText: string): XFormsElement {
  return t(
    "item",
    new StringLiteralXFormsElement("label", {}, String(labelText)),
    new StringLiteralXFormsElement("value", {}, String(value))
  );
}

export function setvalue(event: string, ref: string, value?: string): XFormsElement {
  if (value !== undefined) {
    return new EmptyXFormsElement("setvalue", { event, ref, value });
  }
  return new EmptyXFormsElement("setvalue", { event, ref });
}
