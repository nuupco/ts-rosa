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
  | "long"
  | "geoshape"
  | "geotrace"
  | "uncast"
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
 *   odk:rank          -> "selectMulti" (pyxform's rank bind type; reuses the
 *                        selectMulti codec, per ADR Decision 2 in
 *                        sdd/rank-control/design — verified against pyxform
 *                        3.0.1 source: question_type_dictionary.py maps
 *                        "rank" -> {"control": {"tag": "odk:rank"}, "bind": {"type": "odk:rank"}})
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
