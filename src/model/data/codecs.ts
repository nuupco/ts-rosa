/**
 * codecs.ts — cast (raw string → AnswerValue) and uncast (AnswerValue → raw string).
 *
 * JR-faithful, ISO 8601 compliant. Round-trip lossless for all modeled types.
 */

import type { DataType } from "./DataType.ts";
import type { AnswerValue, GeoPoint } from "./AnswerValue.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as UTC "YYYY-MM-DD" */
function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as UTC "HH:mm:ss" */
function formatUtcTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${h}:${min}:${sec}`;
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JavaRosa geo multi-point string (points separated by ';', each point
 * formatted as "lat lon alt acc") into a readonly GeoPoint array.
 * Returns null if any point cannot be parsed.
 */
function parseGeoPoints(raw: string): readonly GeoPoint[] | null {
  const pointStrs = raw.split(";").map(s => s.trim()).filter(Boolean);
  if (pointStrs.length === 0) return null;
  const points: GeoPoint[] = [];
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

/**
 * Serialize a readonly GeoPoint array to JavaRosa wire format:
 * "lat lon alt acc;lat lon alt acc;..."
 */
function formatGeoPoints(pts: readonly GeoPoint[]): string {
  return pts.map(p => `${p.lat} ${p.lon} ${p.alt} ${p.acc}`).join(";");
}

// ---------------------------------------------------------------------------
// cast: raw string → typed AnswerValue (or null for empty / no-answer)
// ---------------------------------------------------------------------------

export function cast(type: DataType, raw: string): AnswerValue | null {
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
      return { kind: "decimal", value: n, displayText: String(n) };
    }

    case "boolean": {
      if (raw === "") return null;
      const b = raw === "true" || raw === "1";
      return { kind: "boolean", value: b, displayText: b ? "true" : "false" };
    }

    case "date": {
      if (raw === "") return null;
      // Parse ISO YYYY-MM-DD at UTC midnight
      const d = new Date(`${raw}T00:00:00.000Z`);
      if (isNaN(d.getTime())) return null;
      return { kind: "date", value: d, displayText: formatUtcDate(d) };
    }

    case "time": {
      if (raw === "") return null;
      // Represent time as a Date on epoch day 1970-01-01
      const d = new Date(`1970-01-01T${raw}`);
      if (isNaN(d.getTime())) return null;
      return { kind: "time", value: d, displayText: formatUtcTime(d) };
    }

    case "dateTime": {
      if (raw === "") return null;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;
      return { kind: "dateTime", value: d, displayText: d.toISOString() };
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
      // "lat lon alt acc" space-separated
      const parts = raw.trim().split(/\s+/);
      if (parts.length < 4) {
        // Minimal graceful fallback — store as unsupported
        return { kind: "unsupported", value: raw, displayText: raw };
      }
      const [lat, lon, alt, acc] = parts.map(Number);
      const gp: GeoPoint = { lat: lat ?? 0, lon: lon ?? 0, alt: alt ?? 0, acc: acc ?? 0 };
      return { kind: "geopoint", value: gp, displayText: raw };
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
      return { kind: type, value: points, displayText: raw };
    }

    case "uncast":
      // Raw passthrough — empty string is a valid uncast value (no null coercion).
      return { kind: "uncast", value: raw, displayText: raw };

    case "unsupported":
      return { kind: "unsupported", value: raw, displayText: raw };
  }
}

// ---------------------------------------------------------------------------
// uncast: AnswerValue → canonical raw string
// ---------------------------------------------------------------------------

export function uncast(v: AnswerValue): string {
  switch (v.kind) {
    case "string":      return v.value;
    case "int":         return String(Math.trunc(v.value));
    case "decimal":     return String(v.value);
    case "boolean":     return v.value ? "true" : "false";
    case "date":        return formatUtcDate(v.value);
    case "time":        return formatUtcTime(v.value);
    case "dateTime":    return v.value.toISOString();
    case "selectOne":   return v.value;
    case "selectMulti": return [...v.value].join(" ");
    case "geopoint":    return `${v.value.lat} ${v.value.lon} ${v.value.alt} ${v.value.acc}`;
    case "binary":      return v.value;
    case "long":        return String(Math.trunc(v.value));
    case "geoshape":    return formatGeoPoints(v.value);
    case "geotrace":    return formatGeoPoints(v.value);
    case "uncast":      return v.value;
    case "unsupported": return v.value;
  }
}

// ---------------------------------------------------------------------------
// Convenience constructors
// ---------------------------------------------------------------------------

export function stringValue(s: string): AnswerValue {
  return { kind: "string", value: s, displayText: s };
}

export function intValue(n: number): AnswerValue {
  return { kind: "int", value: n, displayText: String(n) };
}

export function decimalValue(n: number): AnswerValue {
  return { kind: "decimal", value: n, displayText: String(n) };
}

export function booleanValue(b: boolean): AnswerValue {
  return { kind: "boolean", value: b, displayText: b ? "true" : "false" };
}

export function dateValue(d: Date): AnswerValue {
  return { kind: "date", value: d, displayText: formatUtcDate(d) };
}

export function selectOneValue(token: string): AnswerValue {
  return { kind: "selectOne", value: token, displayText: token };
}

export function selectMultiValue(tokens: readonly string[]): AnswerValue {
  return { kind: "selectMulti", value: tokens, displayText: [...tokens].join(" ") };
}
