# Where this agent stops

Accepting a time zone name that Node's own time zone data does not know, because any answer for it would be invented; it says the name is unknown, names it, and converts nothing.
Guessing a time zone from a city or country name such as Paris, France or Japan, because a city or country can span several zones; it asks for an IANA name such as Europe/Paris and converts nothing.
Converting a date and time that is not a real calendar date and clock time, such as 2026-02-30T10:00, because no moment matches it; it says so and converts nothing.
Converting a clock time that the first place skips when its clocks jump forward, because that moment never happens there; it says the time does not exist in that zone and converts nothing.
Giving a guessed time when Node's own time zone data cannot be read or fails, because a wrong time is worse than none; it says the conversion could not be made.
