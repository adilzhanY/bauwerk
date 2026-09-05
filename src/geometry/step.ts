/**
 * Minimal ISO 10303-21 (STEP physical file) writer. Enough for IFC4: entity
 * instances `#n=NAME(attr,attr,...);`, typed values, enumerations, references,
 * lists, `$` for unset and `*` for derived attributes.
 *
 * Strings: apostrophes are doubled, backslashes doubled, and any character
 * outside printable ASCII is written with the `\X2\....\X0\` control directive
 * as big-endian UTF-16 hex, which is what German umlauts need.
 */

export type Attr = string;

export const NULL: Attr = "$";
export const DERIVED: Attr = "*";

export const ref = (id: number): Attr => `#${id}`;
export const enm = (name: string): Attr => `.${name}.`;
export const list = (items: readonly Attr[]): Attr => `(${items.join(",")})`;
export const typed = (type: string, value: Attr): Attr => `${type}(${value})`;
export const bool = (v: boolean): Attr => (v ? ".T." : ".F.");
export const int = (n: number): Attr => String(Math.round(n));

/** STEP reals always carry a decimal point: 3 becomes `3.`, 0.25 stays `0.25`. */
export function real(n: number): Attr {
  if (!Number.isFinite(n)) throw new Error(`Not a finite number: ${n}`);
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return `${rounded}.`;
  let text = rounded.toFixed(6);
  text = text.replace(/0+$/, "");
  return text;
}

export function str(s: string): Attr {
  let out = "";
  let inX2 = false;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) {
      if (inX2) {
        out += "\\X0\\";
        inX2 = false;
      }
      if (ch === "'") out += "''";
      else if (ch === "\\") out += "\\\\";
      else out += ch;
    } else {
      if (!inX2) {
        out += "\\X2\\";
        inX2 = true;
      }
      // \X2\ encodes UTF-16 code units, 4 hex digits each.
      const units =
        code > 0xffff
          ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)]
          : [code];
      for (const u of units) out += u.toString(16).toUpperCase().padStart(4, "0");
    }
  }
  if (inX2) out += "\\X0\\";
  return `'${out}'`;
}

export const label = (s: string): Attr => typed("IFCLABEL", str(s));
export const text = (s: string): Attr => typed("IFCTEXT", str(s));

export interface StepHeader {
  description: string;
  fileName: string;
  timestamp: string;
  author: string;
  organization: string;
  preprocessor: string;
  originatingSystem: string;
  authorization: string;
  schema: string;
}

export class StepWriter {
  private readonly lines: string[] = [];
  private nextId = 1;

  /** Adds an entity instance and returns its id. */
  add(entity: string, attrs: readonly Attr[]): number {
    const id = this.nextId++;
    this.lines.push(`#${id}=${entity}(${attrs.join(",")});`);
    return id;
  }

  get count(): number {
    return this.lines.length;
  }

  toString(header: StepHeader): string {
    const h = [
      "ISO-10303-21;",
      "HEADER;",
      `FILE_DESCRIPTION((${str(header.description)}),'2;1');`,
      `FILE_NAME(${str(header.fileName)},${str(header.timestamp)},(${str(header.author)}),(${str(header.organization)}),${str(header.preprocessor)},${str(header.originatingSystem)},${str(header.authorization)});`,
      `FILE_SCHEMA((${str(header.schema)}));`,
      "ENDSEC;",
      "DATA;",
    ];
    return [...h, ...this.lines, "ENDSEC;", "END-ISO-10303-21;", ""].join("\n");
  }
}

const GUID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

function fnv1a(input: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * 22 character IFC GlobalId derived from a model id, so the same element gets
 * the same GlobalId on every export. Four 32-bit FNV-1a hashes give 128 bits,
 * packed 6 bits per character in the IFC base64 alphabet (first char 2 bits).
 */
export function ifcGuid(input: string): string {
  const words = [0, 1, 2, 3].map((i) => fnv1a(input, i * 0x9e3779b9));
  // 128 bits as a BigInt
  let n = 0n;
  for (const w of words) n = (n << 32n) | BigInt(w);
  let out = "";
  for (let i = 0; i < 22; i++) {
    const shift = BigInt((21 - i) * 6);
    const idx = Number((n >> shift) & 63n);
    out += GUID_ALPHABET[i === 0 ? idx & 3 : idx] ?? "0";
  }
  return out;
}
