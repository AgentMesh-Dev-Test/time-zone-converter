// Converting a date and time decides on one moment, and refuses rather than
// guesses.
//
// What is worth pinning: the same moment is found in the second zone and the
// difference is the second zone's offset minus the first's, signed and
// fractional where the zones are; a name Node's time zone data does not know
// is refused and named; a city or country name is refused even where an old
// alias spells it, and nothing is guessed from it; a date and time that is
// not real is refused; a clock time the clocks skip is refused; a clock time
// that happens twice gives the earlier moment and says it was ambiguous;
// nothing to convert names each missing piece and exits 3; and when the time
// zone data fails nothing is guessed. The whole job, run as a process, prints
// one JSON object whose reply is the answer and files the conversion as a
// Markdown piece only when there is one.
// Nothing here touches a network or a model: the time zone data that fails is
// a stand-in the test hands in, and every expected time is worked a second
// way, by searching the minutes of the day with Node's own Intl.
// Run: node --test test/convert-a-date-and-time.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { convert, readInputs, missingOf, replyOf, runJob } from "../scripts/convert-a-date-and-time.mjs";
import { worked } from "./worked-values.test.mjs";
import { checkDelivered } from "./delivered-formats.test.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "..", "scripts", "convert-a-date-and-time.mjs");

// A second way to the answer, never the script's: the wall clock in a zone at
// an instant, read from Intl, and the instant found by walking every minute
// of two days for the earliest one whose wall clock in the first zone is the
// one given.
function wallIn(zone, ms) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function earliestInstant(wall, zone) {
  const [d, t] = wall.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, day, h, mi);
  for (let ms = asUtc - 26 * 3600000; ms <= asUtc + 26 * 3600000; ms += 60000) {
    if (wallIn(zone, ms) === wall) return ms;
  }
  return null;
}
function convertedBySearch(wall, from, to) {
  const ms = earliestInstant(wall, from);
  return wallIn(to, ms);
}
function hoursApart(wall, from, to) {
  const ms = earliestInstant(wall, from);
  const asUtc = (zone) => {
    const [d, t] = wallIn(zone, ms).split("T");
    const [y, m, day] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    return Date.UTC(y, m - 1, day, h, mi);
  };
  return (asUtc(to) - asUtc(from)) / 3600000;
}

const DENVER_TO_PARIS = worked("2026-11-12T17:30", () => convertedBySearch("2026-11-12T09:30", "America/Denver", "Europe/Paris"), "2026-11-12T09:30 Denver in Paris");
const DENVER_PARIS_HOURS = worked(8, () => hoursApart("2026-11-12T09:30", "America/Denver", "Europe/Paris"), "Paris minus Denver on 2026-11-12");
const UTC_TO_KOLKATA = worked("2026-01-16T03:30", () => convertedBySearch("2026-01-15T22:00", "UTC", "Asia/Kolkata"), "2026-01-15T22:00 UTC in Kolkata");
const UTC_KOLKATA_HOURS = worked(5.5, () => hoursApart("2026-01-15T22:00", "UTC", "Asia/Kolkata"), "Kolkata minus UTC");
const PARIS_TO_DENVER = worked("2026-07-01T04:00", () => convertedBySearch("2026-07-01T12:00", "Europe/Paris", "America/Denver"), "2026-07-01T12:00 Paris in Denver");
const PARIS_DENVER_HOURS = worked(-8, () => hoursApart("2026-07-01T12:00", "Europe/Paris", "America/Denver"), "Denver minus Paris on 2026-07-01");
const DOUBLED_IN_UTC = worked("2026-11-01T07:30", () => convertedBySearch("2026-11-01T01:30", "America/Denver", "UTC"), "the earlier 01:30 in Denver on 2026-11-01, in UTC");

function folders(fn) {
  const at = mkdtempSync(join(tmpdir(), "time-zone-converter-"));
  try {
    const job = join(at, "job-1");
    const records = join(at, "records");
    const work = join(at, "work");
    for (const d of [join(job, "out"), records, work]) mkdirSync(d, { recursive: true });
    return fn({ at, job, records, work });
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
}

function runScript(message, { job, records, work }) {
  const file = join(job, "message.txt");
  writeFileSync(file, message);
  const r = spawnSync("node", [SCRIPT, "--job", job, "--records", records, "--work", work, "--text-file", file], { encoding: "utf8" });
  let printed = null;
  try { printed = JSON.parse(r.stdout.trim()); } catch { printed = null; }
  return { code: r.status, printed, stdout: r.stdout };
}

const message = (datetime, from, to) => JSON.stringify({ datetime, from, to });

test("[F1.A1] a Denver morning is the same moment in Paris, eight hours ahead", () => {
  const r = convert({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" });
  assert.equal(r.ok, true);
  assert.equal(r.datetime_to, DENVER_TO_PARIS);
  assert.equal(r.difference_hours, DENVER_PARIS_HOURS);
  assert.equal(r.from, "America/Denver");
  assert.equal(r.to, "Europe/Paris");
  assert.equal(r.datetime_from, "2026-11-12T09:30");
});

test("[F1.A1] the whole job prints the conversion as its reply and files it as a Markdown piece with every header field", () => {
  folders(({ job, records, work }) => {
    const run = runScript(message("2026-11-12T09:30", "America/Denver", "Europe/Paris"), { job, records, work });
    assert.equal(run.code, 0);
    assert.ok(run.printed && typeof run.printed.reply === "string", "it prints one JSON object with a reply");
    const reply = run.printed.reply;
    assert.match(reply, /^from: America\/Denver$/m);
    assert.match(reply, /^to: Europe\/Paris$/m);
    assert.match(reply, /^datetime_from: 2026-11-12T09:30$/m);
    assert.match(reply, new RegExp(`^datetime_to: ${DENVER_TO_PARIS}$`, "m"));
    assert.match(reply, new RegExp(`^difference_hours: ${DENVER_PARIS_HOURS}$`, "m"));
    const pieces = JSON.parse(readFileSync(join(job, "pieces.json"), "utf8"));
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0].name, "conversion");
    assert.equal(pieces[0].media_type, "text/markdown");
    assert.equal(readFileSync(join(job, pieces[0].path), "utf8").trim(), reply.trim());
    assert.deepEqual(checkDelivered(job), []);
  });
});

test("[F1.R3] the date and time is read with or without seconds, and seconds are kept", () => {
  const r = convert({ datetime: "2026-11-12T09:30:15", from: "America/Denver", to: "Europe/Paris" });
  assert.equal(r.ok, true);
  assert.equal(r.datetime_to, `${DENVER_TO_PARIS}:15`);
});

test("[F1.R3] a date and time carrying its own offset is not the form it takes and is refused", () => {
  const r = convert({ datetime: "2026-11-12T09:30-07:00", from: "America/Denver", to: "Europe/Paris" });
  assert.equal(r.ok, false);
  assert.match(replyOf(r), /not a date and time/);
});

test("[F1.A2] a fractional difference that carries the time into the next day", () => {
  const r = convert({ datetime: "2026-01-15T22:00", from: "UTC", to: "Asia/Kolkata" });
  assert.equal(r.ok, true);
  assert.equal(r.datetime_to, UTC_TO_KOLKATA);
  assert.equal(r.difference_hours, UTC_KOLKATA_HOURS);
  assert.equal(r.to, "Asia/Kolkata", "the name is answered as the caller gave it");
});

test("[F1.A3] going west gives a negative difference", () => {
  const r = convert({ datetime: "2026-07-01T12:00", from: "Europe/Paris", to: "America/Denver" });
  assert.equal(r.ok, true);
  assert.equal(r.datetime_to, PARIS_TO_DENVER);
  assert.equal(r.difference_hours, PARIS_DENVER_HOURS);
});

test("[F1.A4] a time zone name Node does not know is refused, named, and nothing is converted", () => {
  const r = convert({ datetime: "2026-11-12T09:30", from: "America/Denverr", to: "Europe/Paris" });
  assert.equal(r.ok, false);
  assert.equal(r.datetime_to, undefined, "no conversion is given");
  const reply = replyOf(r);
  assert.match(reply, /unknown time zone/);
  assert.match(reply, /America\/Denverr/);
});

test("[F1.A4] the second place is checked as the first is", () => {
  const r = convert({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Pariss" });
  assert.equal(r.ok, false);
  assert.match(replyOf(r), /unknown time zone/);
  assert.match(replyOf(r), /Europe\/Pariss/);
});

test("[F1.A5] a city or country name is refused and no time zone is guessed from it, even where an old alias spells it", () => {
  for (const name of ["Paris", "France", "Japan", "Egypt", "New York"]) {
    const r = convert({ datetime: "2026-11-12T09:30", from: name, to: "America/Denver" });
    assert.equal(r.ok, false, `${name} is refused`);
    assert.equal(r.datetime_to, undefined, `nothing is converted for ${name}`);
    assert.match(replyOf(r), /not an IANA time zone name/);
  }
});

test("[F1.R4] UTC and Area/Location names Node knows are taken", () => {
  for (const [from, to] of [["UTC", "Europe/Paris"], ["America/Argentina/Buenos_Aires", "Asia/Kathmandu"], ["Etc/GMT+5", "Australia/Adelaide"]]) {
    assert.equal(convert({ datetime: "2026-11-12T09:30", from, to }).ok, true, `${from} to ${to}`);
  }
});

test("[F1.A6] a date that is not real is refused and nothing is converted", () => {
  for (const datetime of ["2026-02-30T10:00", "2026-13-01T10:00", "2026-11-12T24:30", "2026-11-12T09:61", "next Tuesday at noon", "2026-11-12 09:30"]) {
    const r = convert({ datetime, from: "America/Denver", to: "Europe/Paris" });
    assert.equal(r.ok, false, `${datetime} is refused`);
    assert.equal(r.datetime_to, undefined);
    assert.match(replyOf(r), /not a date and time/);
  }
});

test("[F1.A7] a time the clocks jump forward over does not exist and is refused", () => {
  const r = convert({ datetime: "2026-03-08T02:30", from: "America/Denver", to: "Europe/Paris" });
  assert.equal(r.ok, false);
  assert.equal(r.datetime_to, undefined);
  assert.match(replyOf(r), /does not exist in America\/Denver/);
});

test("[F1.A8] a time that happens twice gives the earlier moment and says it was ambiguous", () => {
  const r = convert({ datetime: "2026-11-01T01:30", from: "America/Denver", to: "UTC" });
  assert.equal(r.ok, true);
  assert.equal(r.datetime_to, DOUBLED_IN_UTC);
  assert.equal(r.ambiguous, true);
  assert.match(replyOf(r), /ambiguous/);
  const plain = convert({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "UTC" });
  assert.notEqual(plain.ambiguous, true, "a time that happens once is not called ambiguous");
  assert.doesNotMatch(replyOf(plain), /ambiguous/);
});

test("[F1.A9] with nothing to convert it converts nothing and names each missing piece", () => {
  assert.deepEqual(missingOf({ from: "America/Denver" }), ["datetime", "to"]);
  assert.deepEqual(missingOf({ datetime: "  ", from: "", to: "Europe/Paris" }), ["datetime", "from"]);
  assert.deepEqual(missingOf({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" }), []);
  const r = convert({ from: "America/Denver" });
  assert.equal(r.ok, false);
  assert.equal(r.datetime_to, undefined);
  const reply = replyOf(r);
  assert.match(reply, /missing/);
  assert.match(reply, /the date and time/);
  assert.match(reply, /the second place/);
  assert.doesNotMatch(reply, /the first place/);
});

test("[F1.A9] the whole job with an empty message exits 3, files no piece and says what is missing", () => {
  folders(({ job, records, work }) => {
    const run = runScript("", { job, records, work });
    assert.equal(run.code, 3);
    assert.match(run.printed.reply, /missing/);
    assert.match(run.printed.reply, /the date and time/);
    assert.match(run.printed.reply, /the first place/);
    assert.match(run.printed.reply, /the second place/);
    assert.equal(existsSync(join(job, "out", "conversion.md")), false, "no conversion is filed");
  });
});

test("[F1.A10] when the time zone data fails it says the conversion could not be made and guesses no time", () => {
  const broken = { DateTimeFormat: function () { throw new Error("ICU data could not be loaded"); } };
  const r = convert({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" }, { intl: broken });
  assert.equal(r.ok, false);
  assert.equal(r.error, true);
  assert.equal(r.datetime_to, undefined, "no guessed time");
  const reply = replyOf(r);
  assert.match(reply, /could not be made/);
  assert.match(reply, /time zone data/);
  assert.doesNotMatch(reply, /^datetime_to:/m, "no time in the second place is given");
});

test("[F1.A10] the time zone data failing partway through, after the names are known, gives no time either", () => {
  let made = 0;
  const failsLater = {
    DateTimeFormat: function (...a) {
      made += 1;
      const real = new Intl.DateTimeFormat(...a);
      return { formatToParts: () => { throw new Error("time zone data unreadable"); }, resolvedOptions: () => real.resolvedOptions() };
    },
  };
  const r = convert({ datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" }, { intl: failsLater });
  assert.ok(made > 0);
  assert.equal(r.ok, false);
  assert.equal(r.error, true);
  assert.match(replyOf(r), /time zone data/);
});

test("[F1.A10] a job whose time zone data fails exits 1 and files no piece", () => {
  folders(({ job, records }) => {
    const broken = { DateTimeFormat: function () { throw new Error("ICU data could not be loaded"); } };
    const out = runJob({ text: message("2026-11-12T09:30", "America/Denver", "Europe/Paris"), jobDir: job, records, intl: broken });
    assert.equal(out.code, 1);
    assert.match(out.reply, /time zone data/);
    assert.equal(existsSync(join(job, "out", "conversion.md")), false);
  });
});

test("[F1.R1] the message is read as JSON or as name: value lines", () => {
  assert.deepEqual(readInputs(message("2026-11-12T09:30", "America/Denver", "Europe/Paris")), { datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" });
  assert.deepEqual(readInputs("datetime: 2026-11-12T09:30\nfrom: America/Denver\nto: Europe/Paris\n"), { datetime: "2026-11-12T09:30", from: "America/Denver", to: "Europe/Paris" });
  assert.deepEqual(readInputs(""), { datetime: "", from: "", to: "" });
});

test("[F1.R5, F1.R6, F1.R7, F1.R8] a refusal printed by the whole job carries the refused field and files no piece", () => {
  folders(({ job, records, work }) => {
    const run = runScript(message("2026-11-12T09:30", "Paris", "Europe/Paris"), { job, records, work });
    assert.equal(run.code, 0);
    assert.match(run.printed.reply, /^refused: /m);
    assert.match(run.printed.reply, /not an IANA time zone name/);
    assert.equal(existsSync(join(job, "out", "conversion.md")), false);
  });
});

test("[C1] the script reaches no network and calls no model", () => {
  const source = readFileSync(SCRIPT, "utf8");
  for (const word of ["node:http", "node:https", "node:net", "node:dns", "fetch(", "MODEL_NAME", "MODEL_ENDPOINT", "MODEL_KEY", "MODEL_PROTOCOL", "process.env"]) {
    assert.equal(source.includes(word), false, `the script does not use ${word}`);
  }
  const descriptor = JSON.parse(readFileSync(join(here, "..", "agent-descriptor.json"), "utf8"));
  const how = descriptor.offerings.find((o) => o.id === "convert-a-date-and-time").how;
  assert.deepEqual(how, { control: "script", intelligence: "none", cost: "none", contract: "full" });
  const needs = JSON.parse(readFileSync(join(here, "..", "agent-runtime-requirements.json"), "utf8"));
  assert.deepEqual(needs.systems, []);
});
