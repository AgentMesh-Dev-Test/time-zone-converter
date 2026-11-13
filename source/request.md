Name: time-zone-converter. A caller gives it a date and time, the place it is in, and a second place, each place as an IANA time zone name such as America/Denver or Europe/Paris. It answers with the same moment as the date and time in the second place, and the difference in hours between the two. It reaches no outside system and uses no model: Node's own time zone data is enough. It refuses a time zone name it does not know, and it refuses to guess a time zone from a city or country name. It is free.

This is everything I am going to tell you up front. Take it from the spec to an open pull request against main, running the check after every change. Where only I can decide, ask me plainly and give your recommendation; stop and wait only then.

## The person asked for changes (2026-11-12)

I sent the spec back for one change only: make this version 0.1.1. Nothing else about the agent changes. Version 0.1.0 is installed on AgentMesh but its package left out the script, so it could not run; the plugin now packs the script inside the skill, and AgentMesh only takes an update whose version is higher. Run the check, commit and push this branch, and stop for my approval.
