# nuLiga REST feasibility probe

Standalone diagnostic tool. **Not connected to the PWA, not a working import.**

Confirmed REST resource templates (nuLiga documentation):
- `/2014/meetings/{meetingId}`
- `/2014/meetings/{meetingId}/players`
- `/2014/meetings/{meetingId}/meetingEvents`

Run: `node tools/nuliga/probe.mjs --meeting-id 8279189`
Tests: `node --test tools/nuliga/probe.test.mjs`

**Important:** 8279189 is currently a *web URL meeting identifier*, not confirmed
to be the REST API meetingId. The visible match number 102040 is also not
necessarily the REST meetingId. Use the probe to test, not to assume identity.

The script tests public access without credentials, reports HTTP status,
content type, top-level JSON keys and array counts. It does **not** include
raw player names or event payloads in its console output. It does not
bypass authentication or scrape protected endpoints.

Test fixture: TV Neerstedt – HC Bremen, 2026-10-10, 38:44.
Source public game report:
https://bremerhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/regionMeetingFilter?category=-1&championship=HVNB+Freundschaftsspiele+26%2F27&dayOfYear=278&group=489136&meeting=8279189&month=9

Next gate: verify a real successful JSON response, its license/access restrictions,
meeting ID mapping, player/goal/penalty timestamps, and only then build a
schema-aware mapper with explicit unknown fields. Sportlounge video stays local.
