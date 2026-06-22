/**
 * DataType — the set of XForms primitive data types understood by ts-rosa.
 *
 * Names follow the design (and JavaRosa StandardBindAttributesProcessor),
 * NOT the spec BDD labels:
 *   - 'int' (not 'integer')
 *   - 'unsupported' (not 'uncast')
 */
export type DataType =
  | "string"
  | "int"
  | "decimal"
  | "boolean"
  | "date"
  | "time"
  | "dateTime"
  | "selectOne"
  | "selectMulti"
  | "geopoint"
  | "binary"
  | "unsupported";

/**
 * Map an XSD type attribute string (or control localName hint) to a DataType.
 *
 * Faithful to JavaRosa StandardBindAttributesProcessor:
 *   xsd:string | ""   -> "string"
 *   xsd:int           -> "int"
 *   xsd:integer       -> "int"
 *   xsd:decimal       -> "decimal"
 *   xsd:boolean       -> "boolean"
 *   xsd:date          -> "date"
 *   xsd:time          -> "time"
 *   xsd:dateTime      -> "dateTime"
 *   select1           -> "selectOne"
 *   select            -> "selectMulti"
 *   geopoint          -> "geopoint"
 *   binary            -> "binary"
 *   null | anything else -> "unsupported" (unless null/"" -> "string")
 */
export function dataTypeFromXsdName(xsd: string | null): DataType {
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
      return "selectMulti";
    case "geopoint":
      return "geopoint";
    case "binary":
      return "binary";
    default:
      return "unsupported";
  }
}
