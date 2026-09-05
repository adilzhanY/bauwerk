/**
 * ISO 10303-21 reader for the subset IFC uses: `#id=TYPE(args);` in the DATA
 * section, with nested lists, strings (doubled apostrophes, \X2\ UTF-16 runs,
 * \S\ and \X\ single bytes), typed values `IFCLABEL('x')`, references `#n`,
 * enumerations `.X.`, numbers, `$` and `*`.
 */

export type StepValue =
  | { kind: "null" }
  | { kind: "derived" }
  | { kind: "ref"; id: number }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "enum"; value: string }
  | { kind: "typed"; type: string; value: StepValue }
  | { kind: "list"; items: StepValue[] };

export interface StepEntity {
  id: number;
  type: string;
  args: StepValue[];
}

export interface StepFile {
  schema: string;
  entities: Map<number, StepEntity>;
}

export class StepParseError extends Error {}

export function parseStep(text: string): StepFile {
  const schemaMatch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/.exec(text);
  const schema = schemaMatch?.[1] ?? "";
  const dataStart = text.indexOf("DATA;");
  if (dataStart === -1) throw new StepParseError("No DATA section");
  const body = text.slice(dataStart + 5);
  const entities = new Map<number, StepEntity>();
  let i = 0;
  const n = body.length;
  while (i < n) {
    // Skip whitespace and comments.
    while (i < n && /\s/.test(body[i] ?? "")) i++;
    if (body.startsWith("/*", i)) {
      const end = body.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (body.startsWith("ENDSEC", i) || body.startsWith("END-ISO", i) || i >= n) break;
    if (body[i] !== "#") throw new StepParseError(`Expected '#' at ${i}`);
    i++;
    const idStart = i;
    while (i < n && /\d/.test(body[i] ?? "")) i++;
    const id = Number(body.slice(idStart, i));
    while (i < n && /\s/.test(body[i] ?? "")) i++;
    if (body[i] !== "=") throw new StepParseError(`Expected '=' after #${id}`);
    i++;
    while (i < n && /\s/.test(body[i] ?? "")) i++;
    const typeStart = i;
    while (i < n && /[A-Z0-9_]/i.test(body[i] ?? "")) i++;
    const type = body.slice(typeStart, i).toUpperCase();
    const [args, next] = parseList(body, i);
    i = next;
    while (i < n && /\s/.test(body[i] ?? "")) i++;
    if (body[i] !== ";") throw new StepParseError(`Expected ';' after #${id}`);
    i++;
    entities.set(id, { id, type, args });
  }
  return { schema, entities };
}

function parseList(s: string, i: number): [StepValue[], number] {
  if (s[i] !== "(") throw new StepParseError(`Expected '(' at ${i}`);
  i++;
  const items: StepValue[] = [];
  for (;;) {
    while (/\s/.test(s[i] ?? "")) i++;
    if (s[i] === ")") return [items, i + 1];
    const [value, next] = parseValue(s, i);
    items.push(value);
    i = next;
    while (/\s/.test(s[i] ?? "")) i++;
    if (s[i] === ",") i++;
    else if (s[i] !== ")") throw new StepParseError(`Expected ',' or ')' at ${i}`);
  }
}

function parseValue(s: string, i: number): [StepValue, number] {
  const c = s[i];
  if (c === "$") return [{ kind: "null" }, i + 1];
  if (c === "*") return [{ kind: "derived" }, i + 1];
  if (c === "#") {
    let j = i + 1;
    while (/\d/.test(s[j] ?? "")) j++;
    return [{ kind: "ref", id: Number(s.slice(i + 1, j)) }, j];
  }
  if (c === "'") return parseString(s, i);
  if (c === ".") {
    const end = s.indexOf(".", i + 1);
    if (end === -1) throw new StepParseError(`Unterminated enum at ${i}`);
    return [{ kind: "enum", value: s.slice(i + 1, end) }, end + 1];
  }
  if (c === "(") {
    const [items, next] = parseList(s, i);
    return [{ kind: "list", items }, next];
  }
  if (c !== undefined && /[-+0-9]/.test(c)) {
    let j = i + 1;
    while (/[0-9.eE+-]/.test(s[j] ?? "")) j++;
    return [{ kind: "number", value: Number(s.slice(i, j)) }, j];
  }
  if (c !== undefined && /[A-Z]/i.test(c)) {
    let j = i;
    while (/[A-Z0-9_]/i.test(s[j] ?? "")) j++;
    const type = s.slice(i, j).toUpperCase();
    const [inner, next] = parseList(s, j);
    return [{ kind: "typed", type, value: inner[0] ?? { kind: "null" } }, next];
  }
  throw new StepParseError(`Unexpected character '${c ?? "EOF"}' at ${i}`);
}

function parseString(s: string, i: number): [StepValue, number] {
  let j = i + 1;
  let out = "";
  while (j < s.length) {
    const c = s[j];
    if (c === "'") {
      if (s[j + 1] === "'") {
        out += "'";
        j += 2;
        continue;
      }
      return [{ kind: "string", value: decodeControl(out) }, j + 1];
    }
    out += c ?? "";
    j++;
  }
  throw new StepParseError(`Unterminated string at ${i}`);
}

/** Decodes \X2\....\X0\ UTF-16 runs, \X\hh single bytes and \S\c ISO 8859 shifts. */
export function decodeControl(s: string): string {
  return s
    .replace(/\\X2\\([0-9A-F]+)\\X0\\/g, (_, hex: string) => {
      let out = "";
      for (let k = 0; k + 4 <= hex.length; k += 4)
        out += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
      return out;
    })
    .replace(/\\X4\\([0-9A-F]+)\\X0\\/g, (_, hex: string) => {
      let out = "";
      for (let k = 0; k + 8 <= hex.length; k += 8)
        out += String.fromCodePoint(parseInt(hex.slice(k, k + 8), 16));
      return out;
    })
    .replace(/\\X\\([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\S\\(.)/g, (_, ch: string) => String.fromCharCode(ch.charCodeAt(0) + 128))
    .replace(/\\\\/g, "\\");
}

// Accessors that tolerate wrong kinds by returning undefined.
export const asRef = (v: StepValue | undefined): number | undefined =>
  v?.kind === "ref" ? v.id : undefined;
export const asNumber = (v: StepValue | undefined): number | undefined =>
  v?.kind === "number" ? v.value : v?.kind === "typed" ? asNumber(v.value) : undefined;
export const asString = (v: StepValue | undefined): string | undefined =>
  v?.kind === "string" ? v.value : v?.kind === "typed" ? asString(v.value) : undefined;
export const asEnum = (v: StepValue | undefined): string | undefined =>
  v?.kind === "enum" ? v.value : undefined;
export const asList = (v: StepValue | undefined): StepValue[] =>
  v?.kind === "list" ? v.items : [];
export const asRefs = (v: StepValue | undefined): number[] =>
  asList(v)
    .map(asRef)
    .filter((x): x is number => x !== undefined);
