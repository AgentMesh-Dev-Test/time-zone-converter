---
name: convert-a-date-and-time
description: When someone knows a date and time in one IANA time zone and needs the same moment's clock time in another.
---

# Convert a date and time

Part of time-zone-converter. When someone knows a date and time in one IANA time zone and needs the same moment's clock time in another.

## When to use this

When someone knows a date and time in one IANA time zone and needs the same moment's clock time in another.

## What this needs

- datetime (text, required)
- from (identifier, required)
- to (identifier, required)

## What a good result looks like

The header gives both zone names, the date and time as given, the same moment's date and time in the second zone, and the second zone's offset minus the first's in hours, which may be negative or fractional, and the sentence says the same.

## What it produces

- conversion (text/markdown, per task)

## When it comes back empty

When the date and time, the first place or the second place is missing or blank, it converts nothing and names each piece that is missing, so the caller can send it again.

## How to do it

Run scripts/convert-a-date-and-time.mjs with the job. It checks that the date and time is written as 2026-11-12T09:30, with optional seconds, and is a real date and time; that each place is an IANA Area/Location name, or UTC, that Node's own time zone data knows; and refuses otherwise. It then finds the moment that clock time names in the first zone, refusing a time the clocks skip and taking the earlier of a time that happens twice, which it marks as ambiguous, and writes that moment's date and time in the second zone with the difference in hours. Hand back its reply as it is; never correct a zone name or a time on the caller's behalf.

## Scripts

Run these from this skill's folder; each one says what it needs at the top.

- scripts/convert-a-date-and-time.mjs
