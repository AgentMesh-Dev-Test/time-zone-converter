---
record: architecture-record-v1
statement: "Name: time-zone-converter. A caller gives it a date and time, the place it is in, and a second place, each place as an IANA time zone name such as America/Denver or Europe/Paris. It answers with the same moment as the date and time in the s"
environments: [dev, test, production]
kind: plugin-on-harness
done: yes
questions: 0
systems: []
standing_assets: [https://schemas.agentmesh.ai/brand/v1, https://schemas.agentmesh.ai/style-guide/v1]
cost_limit: "nothing: it calls no model and reaches no outside system, so it spends nothing on any run"
bindings: none
---

# Architecture record: converting a date and time between time zones

This record is finished: every system is named and bound in each environment, and every decision has its reason.

## Statement

> Name: time-zone-converter. A caller gives it a date and time, the place it is in, and a second place, each place as an IANA time zone name such as America/Denver or Europe/Paris. It answers with the same moment as the date and time in the second place, and the difference in hours between the two. It reaches no outside system and uses no model: Node's own time zone data is enough. It refuses a time zone name it does not know, and it refuses to guess a time zone from a city or country name. It is free.
>
> This is everything I am going to tell you up front. Take it from the spec to an open pull request against main, running the check after every change. Where only I can decide, ask me plainly and give your recommendation; stop and wait only then.
>
> ## The person asked for changes (2026-11-12)
>
> I sent the spec back for one change only: make this version 0.1.1. Nothing else about the agent changes. Version 0.1.0 is installed on AgentMesh but its package left out the script, so it could not run; the plugin now packs the script inside the skill, and AgentMesh only takes an update whose version is higher. Run the check, commit and push this branch, and stop for my approval.
>
> ## The person asked for changes (2026-11-12)
>
> I updated the plugin to 0.2.3 and sent the spec back for one change only: make this version 0.1.2. Nothing else about the agent changes. Version 0.1.1 runs on AgentMesh but its run named no message_file, so the host never wrote my message to the file the command reads; the plugin's generator now declares it. Run the check, commit and push this branch, and stop for my approval.

## Systems

This agent reaches no system outside its own folder.

## Bindings

Nothing to bind.

## Dependencies

None.

## Kind

**plugin-on-harness**: A short, exact program with no judgment in it: check the three inputs, convert with Node's own time zone data, write the answer. A harness reading one skill carries it.

## Components

- **the harness** (`harness`), the harness: Starts the skill's script once per job, hands it the job's input and settings, and sends back what it writes as the reply.
  - **convert-time** (`skill-convert-time`), a skill: Converts a date and time in one IANA time zone to the same moment in a second, with the difference in hours, or refuses.
    - **scripts/convert-time.mjs** (`script-convert-time`), a script: Checks the date and time and both zone names, converts the moment with Node's own time zone data, and writes the answer or the refusal.
      - **input checker** (`input-checker`), a part: Finds what is missing, refuses a date and time that is not real, and refuses a name that is unknown or is a city or country name.
      - **zone converter** (`zone-converter`), a part: Finds the moment the wall clock time names in the first zone, refusing a skipped time and taking the earlier of a doubled one, and gives that moment's clock time in the second zone and the difference in hours.
      - **answer writer** (`answer-writer`), a part: Writes the conversion or the refusal as the Markdown answer.

## Connectors

- `caller` to `harness`: a job message, which the host hands to the harness; it carries the date and time and the two places.
- `harness` to `script-convert-time`: by command: node scripts/convert-time.mjs, started once per job, with the job's input as flags (the job's run, Common Agent Section 12.3); it carries the date and time, the first place and the second place.
- `script-convert-time` to `caller`: written to the script's standard output, which the harness hands back as the job's reply; it carries the conversion (`text/markdown`).

## Runtime and deployment

Runs once per job: the harness starts the skill's script as a command, and the process ends when the reply is written. It has no service of its own, opens no port and keeps no process between jobs.

- dev: no system to bind.
- test: no system to bind.
- production: no system to bind.

## Data flow

1. `caller` to `harness`, the date and time and the two places: The caller asks for the moment in the second place.
2. `harness` to `input-checker`, the date and time and the two places: The harness starts the script with the job's inputs.
3. `input-checker` to `zone-converter`, the checked date and time and zone names: Only inputs that passed every check are converted.
4. `zone-converter` to `answer-writer`, the converted date and time and the difference in hours: The converter hands over the result or the reason it refused.
5. `answer-writer` to `caller`, the conversion: The answer goes back as the reply, through the harness.

## Drivers

- **Cost** (`cost`): nothing: it calls no model and reaches no outside system, so it spends nothing on any run. The person set it in an answer (limit-cost: nothing: it calls no model and reaches no outside system, so it spends nothing on any run).
- **Speed** (`speed`): one conversion answered within 5 seconds. It is one calculation on data already in Node, with nothing to wait on. Cited by decisions 1 and 3.
- **Data** (`data`): reads only the date and time and the two time zone names it is given; keeps nothing between runs and sends nothing anywhere. It reaches no outside system and stores no record.
- **Trust** (`trust`): takes a job from any caller; it only computes and answers, and refuses rather than guesses. Nothing it does changes anything outside its own reply. Cited by decision 2.
- **Self-contained** (`no-outside-system`): It reaches no outside system and uses no model; Node's own time zone data is enough. From the statement: "It reaches no outside system and uses no model: Node's own time zone data is enough". Cited by decision 1.
- **Exactness** (`no-guessing`): It refuses a name it does not know and never guesses a time zone from a city or country name. From the statement: "it refuses to guess a time zone from a city or country name". Cited by decision 2.

## Egress

- dev: the target runs the agent open (it enforces no allowlist today).
- test: the target runs the agent open (it enforces no allowlist today).
- production: the target runs the agent open (it enforces no allowlist today).
- None beyond the derived set (its systems, the network, the registrar, the model it is given).

## Formats

- It takes the date and time as `text`, given by a person or an agent; a calendar date and wall clock time, as 2026-11-12T09:30, seconds optional, no offset. A person or an agent says when, in the first place's own clock time.
- It takes the first place as `identifier`, given by a person or an agent; an IANA time zone name, such as America/Denver. The place the date and time is in.
- It takes the second place as `identifier`, given by a person or an agent; an IANA time zone name, such as Europe/Paris. The place to convert to.
- It hands back the conversion as `text/markdown`; a header of the fields from, to, datetime_from, datetime_to and difference_hours, then one sentence saying the same in words; a refusal is the header field refused and one sentence saying why. A person reads it, and an agent can take the header fields.

## Standing assets

- **the conversion** (`text/markdown`, written copy): the style guide (`https://schemas.agentmesh.ai/style-guide/v1`), because written copy a person reads speaks for the organization, and the style guide says its voice, its spelling and the words it uses and avoids; the brand profile (`https://schemas.agentmesh.ai/brand/v1`), because written copy that speaks for the organization names it, and the brand profile says how its name is written, how it is first mentioned and the words it never says.
- The Design declares exactly these as `can_use`, each with what it reads, what it does with it and what it does `without` it: `https://schemas.agentmesh.ai/brand/v1`, `https://schemas.agentmesh.ai/style-guide/v1`.

## Settings

No setting beyond the bindings' own.

## Decisions

Decisions 1 to 3 choose the agent's structure.

### Decision 1. A program does the whole conversion with Node's own time zone data, and no model is called

Context: Converting a moment between time zones is exact arithmetic over the time zone database, which Node carries.

Drivers: `no-outside-system` (It reaches no outside system and uses no model; Node's own time zone data is enough); `speed` (one conversion answered within 5 seconds).

Why: The answer has one right value, so code gives it every time, testably, at no cost.

Alternatives:

- A model that reads the request and works out the time: not chosen, because It could guess, and the person said it uses no model.
- A time zone service on the network: not chosen, because It would be an outside system, and Node's own data is enough.

Consequences:

- The job is control script, intelligence none and contract full.
- Its answers are as current as the time zone data of the Node it runs on.

### Decision 2. Accept only Area/Location names and UTC, checked against Node's own data

Context: Node's data also knows old single-word aliases such as Japan and Egypt, which read as country names.

Drivers: `no-guessing` (It refuses a name it does not know and never guesses a time zone from a city or country name); `trust` (takes a job from any caller; it only computes and answers, and refuses rather than guesses).

Why: A single-word name other than UTC is refused as a city or country name, so nothing is guessed from one.

Alternatives:

- Accept every name Node accepts: not chosen, because Japan or Egypt would be taken as a time zone, which reads as guessing from a country name.

Consequences:

- A caller writes Asia/Tokyo, not Japan.

### Decision 3. Answer synchronously as Markdown

Context: One conversion, read by a person or taken by an agent.

Drivers: `speed` (one conversion answered within 5 seconds).

Why: The reply is ready at once, and a short header lets an agent read the fields.

Alternatives:

- a vendor JSON kind: not chosen, because A person reads the answer as often as code does.

Consequences:

- Its header fields are fixed so a test can hold them.

## Questions

None. Every system is named and bound in each environment, and every decision has its reason.
