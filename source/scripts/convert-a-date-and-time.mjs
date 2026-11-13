// Converts a date and time in one IANA time zone to the same moment in a
// second, with the difference in hours, from Node's own time zone data alone.
//
//   needs: node >= 22, nothing else; reaches no network and no model
//   node convert-a-date-and-time.mjs --job <job_dir> --records <records> --work <work> --text-file <message.txt>
//
// The message gives datetime, from and to, as one JSON object or as
// "name: value" lines. It prints one JSON object, {"reply": "..."}, and on a
// conversion files out/conversion.md in pieces.json.
// Exit 0 with a conversion or a refusal, 3 when there is nothing to convert,
// 1 when the time zone data fails, 2 when --job is not given.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INPUTS = ["datetime", "from", "to"];
const SAID = { datetime: "the date and time", from: "the first place", to: "the second place" };
const DAY = 86400000;
const trim = (s) => (typeof s === "string" ? s.trim() : s == null ? "" : String(s).trim());

class DataFailure extends Error {}

/** The three inputs from the message: a JSON object, or name: value lines. */
export function readInputs(text) {
  const out = { datetime: "", from: "", to: "" };
  const t = trim(text);
  if (t.startsWith("{")) {
    try {
      const doc = JSON.parse(t);
      for (const k of INPUTS) out[k] = trim(doc?.[k]);
      return out;
    } catch { /* read as lines */ }
  }
  for (const line of t.split(/\r?\n/)) {
    const m = /^\s*(datetime|from|to)\s*:\s*(.*?)\s*$/i.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/** The inputs that are missing or blank, in order. */
export function missingOf(inputs = {}) {
  return INPUTS.filter((k) => !trim(inputs?.[k]));
}

/** The wall clock a date and time names, or null when it is not one. */
export function parseDateTime(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trim(s));
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const sec = m[6] === undefined ? null : Number(m[6]);
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || (sec !== null && sec > 59)) return null;
  const ms = utcOf(y, mo, d, h, mi, sec ?? 0);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== mo || back.getUTCDate() !== d) return null;
  return { y, mo, d, h, mi, sec, wall: ms };
}

function utcOf(y, mo, d, h, mi, s) {
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(h, mi, s, 0);
  return t.getTime();
}

const pad = (n, w = 2) => String(n).padStart(w, "0");
function wallText(ms, withSeconds) {
  const t = new Date(ms);
  const s = `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  return withSeconds ? `${s}:${pad(t.getUTCSeconds())}` : s;
}

/** Why a name is not taken as a time zone, or null when it is. Only an
 *  Area/Location name, or UTC, is taken; anything else reads as a city or a
 *  country, and nothing is guessed from it. */
export function zoneRefusal(name, intl = Intl) {
  if (name !== "UTC" && !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(name)) {
    return { kind: "not-iana", sentence: `${name} is not an IANA time zone name, and no time zone is guessed from a city or country name. Give an IANA name such as Europe/Paris.` };
  }
  try {
    new intl.DateTimeFormat("en-US", { timeZone: name });
  } catch (e) {
    if (e instanceof RangeError) return { kind: "unknown", sentence: `unknown time zone ${name}: Node's time zone data does not know it. Give an IANA name such as Europe/Paris.` };
    throw new DataFailure(e?.message ?? String(e));
  }
  return null;
}

/** The zone's offset from UTC at an instant, in minutes. */
function offsetOf(intl, zone, ms) {
  let parts;
  try {
    const f = new intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    parts = Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  } catch (e) {
    throw new DataFailure(e?.message ?? String(e));
  }
  const local = utcOf(Number(parts.year), Number(parts.month), Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  const off = Math.round((local - (ms - (ms % 1000 + 1000) % 1000)) / 60000);
  if (!Number.isFinite(off)) throw new DataFailure("the time zone data gave no offset");
  return off;
}

/** The instants a wall clock names in a zone, earliest first: none when the
 *  clocks skip it, two when they go back over it. */
function instantsOf(intl, zone, wall) {
  const found = new Set();
  for (const probe of [wall - DAY, wall, wall + DAY]) {
    const off = offsetOf(intl, zone, probe);
    const t = wall - off * 60000;
    if (offsetOf(intl, zone, t) === off) found.add(t);
  }
  return [...found].sort((a, b) => a - b);
}

/** The conversion, or why there is none. */
export function convert(inputs = {}, { intl = Intl } = {}) {
  const given = Object.fromEntries(INPUTS.map((k) => [k, trim(inputs?.[k])]));
  const missing = missingOf(given);
  if (missing.length) return { ok: false, empty: true, missing };
  const { datetime, from, to } = given;
  const at = parseDateTime(datetime);
  if (!at) return { ok: false, refused: "not a date and time", sentence: `${datetime} is not a date and time; write it as a calendar date and clock time such as 2026-11-12T09:30.` };
  try {
    for (const zone of [from, to]) {
      const why = zoneRefusal(zone, intl);
      if (why) return { ok: false, refused: why.kind === "unknown" ? "unknown time zone" : "not an IANA time zone name", sentence: why.sentence };
    }
    const instants = instantsOf(intl, from, at.wall);
    if (!instants.length) {
      return { ok: false, refused: "does not exist", sentence: `${datetime} does not exist in ${from}: the clocks jump forward over it, so no moment has that clock time there.` };
    }
    const moment = instants[0];
    const offFrom = offsetOf(intl, from, moment);
    const offTo = offsetOf(intl, to, moment);
    const withSeconds = at.sec !== null;
    return {
      ok: true,
      from,
      to,
      datetime_from: datetime,
      datetime_to: wallText(moment + offTo * 60000, withSeconds),
      difference_hours: (offTo - offFrom) / 60,
      ...(instants.length > 1 ? { ambiguous: true } : {}),
    };
  } catch (e) {
    if (e instanceof DataFailure) return { ok: false, error: true, sentence: `The conversion could not be made: Node's time zone data failed (${e.message}). No time is guessed.` };
    throw e;
  }
}

const listed = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function apart(hours, from, to) {
  if (hours === 0) return `${to} keeps the same clock time as ${from}`;
  const n = Math.abs(hours);
  return `${to} is ${n} hour${n === 1 ? "" : "s"} ${hours > 0 ? "ahead of" : "behind"} ${from}`;
}

/** The Markdown answer for a conversion or a refusal. */
export function replyOf(r) {
  if (r.ok) {
    const head = [`from: ${r.from}`, `to: ${r.to}`, `datetime_from: ${r.datetime_from}`, `datetime_to: ${r.datetime_to}`, `difference_hours: ${r.difference_hours}`];
    if (r.ambiguous) head.push("ambiguous: true");
    let sentence = `${r.datetime_from} in ${r.from} is ${r.datetime_to} in ${r.to}; ${apart(r.difference_hours, r.from, r.to)}.`;
    if (r.ambiguous) sentence += ` ${r.datetime_from} is ambiguous in ${r.from}, because it happens twice when the clocks go back; this is the earlier of the two moments.`;
    return `---\n${head.join("\n")}\n---\n\n${sentence}\n`;
  }
  if (r.empty) {
    const names = r.missing.map((k) => SAID[k]);
    return `---\nmissing: ${r.missing.join(", ")}\n---\n\nNothing was converted: ${listed(names)} ${names.length === 1 ? "is" : "are"} missing. Send the date and time, the place it is in and the place to convert to, each place as an IANA time zone name such as America/Denver.\n`;
  }
  if (r.error) return `---\nerror: time zone data\n---\n\n${r.sentence}\n`;
  return `---\nrefused: ${r.refused}\n---\n\nRefused: ${r.sentence}\n`;
}

/** One job: read the message, convert, file the conversion when there is one. */
export function runJob({ text = "", jobDir, intl = Intl } = {}) {
  const r = convert(readInputs(text), { intl });
  const reply = replyOf(r);
  if (r.ok && jobDir) {
    mkdirSync(join(jobDir, "out"), { recursive: true });
    writeFileSync(join(jobDir, "out", "conversion.md"), reply);
    writeFileSync(join(jobDir, "pieces.json"), `${JSON.stringify([{ name: "conversion", path: "out/conversion.md", media_type: "text/markdown" }], null, 2)}\n`);
  }
  return { code: r.ok ? 0 : r.empty ? 3 : r.error ? 1 : 0, reply, result: r };
}

function flagsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (m && i + 1 < argv.length) { out[m[1]] = argv[i + 1]; i += 1; }
  }
  return out;
}

const ranDirectly = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ranDirectly) {
  const flags = flagsOf(process.argv.slice(2));
  if (!flags.job) {
    process.stdout.write(`${JSON.stringify({ reply: "--job is required: the job's folder." })}\n`);
    process.exitCode = 2;
  } else {
    const file = flags["text-file"];
    const text = file && existsSync(file) ? readFileSync(file, "utf8") : "";
    const out = runJob({ text, jobDir: flags.job, records: flags.records });
    process.stdout.write(`${JSON.stringify({ reply: out.reply })}\n`);
    process.exitCode = out.code;
  }
}
