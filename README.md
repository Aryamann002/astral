# Astral

An astrology app that does the arithmetic properly.

Charts are computed from the VSOP87/DE-derived series in
[`astronomy-engine`](https://github.com/cosinekitty/astronomy) and expressed in
the frame Western astrology actually uses: apparent geocentric ecliptic
longitude of date. Nothing is faked, interpolated from a lookup table, or
approximated by sun sign.

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # typecheck + both verification suites
```

## Screens

| | |
| --- | --- |
| **Onboarding** | Birth date, time and place. Place search resolves an IANA timezone, so the UTC offset used is the one that was actually in force on that date — including historical DST rules. |
| **Chart** | Interactive wheel, the big three, every placement with its dignity, houses, and the full aspect list with orbs. Four house systems, switchable. |
| **Today** | A daily reading derived from live transits to the natal chart. |
| **Transits** | Forward scan for aspect perfections with orb windows and exactness dates, grouped by month. |
| **Match** | Synastry: inter-chart aspects, category breakdown, strongest contacts and friction points. |
| **Ask** | A deterministic reading computed on your device, plus a ready-made prompt you can hand to ChatGPT, Claude, Gemini or anything else. No API key, no account, no server. |

## The astronomy

- **Positions** — apparent geocentric ecliptic longitude of date for the Sun,
  Moon and all nine planets. True daily motion (and therefore retrograde
  status) comes from numerical differentiation rather than a lookup.
- **Lunar nodes** — the *true* node, computed as `ẑ × (r × v)` from the Moon's
  position and numerically differentiated velocity, so it tracks the real
  wobble instead of the smoothed mean node.
- **Black Moon Lilith** — the mean lunar apogee, from Meeus' mean elements.
- **Houses** — Placidus by iterative semi-arc division, plus Whole Sign, Equal
  and Porphyry. Placidus is genuinely undefined inside the polar circles, where
  the semi-arcs it needs do not exist; the app detects that and falls back to
  Porphyry rather than emitting nonsense.
- **Angles** — Ascendant and Midheaven from apparent sidereal time and mean
  obliquity (IAU 2006).

### Accuracy

`npm run verify` checks the engine against two independent AA-rated charts.
Every planet and both Placidus angles land within ~2 arcminutes of published
values:

```
— Albert Einstein, 14 Mar 1879, 11:30 LMT, Ulm —
PASS  Sun          got 23° Pisces 30'       expected 23° Pisces 30'       Δ 0.5'
PASS  Ascendant    got 11° Cancer 38'       expected 11° Cancer 39'       Δ 0.3'
PASS  Midheaven    got 12° Pisces 50'       expected 12° Pisces 50'       Δ 0.0'

— Diana, Princess of Wales, 1 Jul 1961, 19:45 BST, Sandringham —
PASS  Ascendant    got 18° Sagittarius 24'  expected 18° Sagittarius 24'  Δ 0.5'
PASS  Midheaven    got 23° Libra 03'        expected 23° Libra 03'        Δ 0.1'
```

`npm run verify:app` exercises every derived surface: timezone resolution
across historical DST rules, chart assembly, interpretation coverage, daily
readings, 90- and 365-day transit forecasts, synastry, and the polar-latitude
and unknown-birth-time edge cases.

It also covers the prompt handoff: topic scoping, that a scoped prompt is
smaller than a full one but still carries the big three, that signs are spelled
out rather than drawn as glyphs, and that an oversized prompt falls back to a
bare handoff URL instead of being silently truncated into one.

## Determinism

The daily reading is computed from the actual transits to your chart at that
moment — nothing is randomised. The same chart on the same date always produces
the same scores, and a quiet sky produces a quiet reading rather than an
invented one.

## Design

UI designed with [Google Stitch](https://stitch.withgoogle.com) against a
custom *Astral Celestial* design system: dark observatory palette, Bodoni Moda
for headlines, Manrope for data, glass surfaces with luminous hairlines instead
of drop shadows. Stitch project `15322030067189419646`.

## Privacy

Birth data lives in `localStorage` and charts are computed in the browser.
Nothing is sent to a server, because there is no server to send it to — no
accounts, no analytics, no database.

**Ask** is the one place chart data can leave the device, and only because you
move it: the reading is computed locally, and the prompt it builds sits on your
clipboard until you paste it. The panel shows the exact text first.

The app's only outbound request is place search during onboarding, which
proxies Open-Meteo through `/api/geocode`. That sends a place name — not a
birth date, not a time, not a chart.

## Ask — bring your own model

Astral needs no API keys, because it never calls a model. Two things happen on
the Ask screen, both in the browser:

**A local reading.** `localAstrologer` matches your question against a topic
table, pulls the placements that govern it out of the chart, and quotes them
back. Deterministic, instant, always available — and narrow by construction: it
quotes, it does not compose.

**A prompt you can take anywhere.** The same topic table decides what a model
would need to answer properly, and `buildPromptPack` assembles it into a
self-contained prompt — reading instructions, the relevant slice of the chart,
and your question. Copy it, or use *Copy & open* to send it to ChatGPT, Claude,
Gemini or Perplexity with the prompt already on your clipboard.

Two scopes. *Just this question* carries the topic's placements, your big three
and chart ruler, and any body its aspects name — roughly 2,700 characters for
something broad like love, less for something narrow like a Saturn return.
*Full chart* carries everything, around 3,100. The prompt never cites a body it
has not positioned: an aspect line like `Sun trine Neptune` drags Neptune's
placement in with it, because otherwise the prompt is asking the model to
reason about a degree it was never given.

Signs are spelled out rather than drawn: a model reads `9° Cancer 39'` more
reliably than `9° ♋︎ 39'`, and the glyph costs nine characters once
URL-encoded.

ChatGPT, Claude and Perplexity accept a prefilled query string. Gemini has no
supported prefill parameter, so it opens blank and you paste. Either way the
prompt is copied before the tab opens, so a blocked prefill or an over-long URL
costs nothing.

## Security

Response headers are set in `next.config.ts` and apply to every route: CSP,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, the two Cross-Origin-* policies, and no `X-Powered-By`.

The CSP keeps `'unsafe-inline'` in `script-src`, deliberately. Every page here
is statically prerendered and Next.js embeds the RSC payload as inline
`<script>` tags — six per page — which a nonce cannot cover, because nonces
are minted per request and adopting one forces every page to dynamic
rendering. That trade buys nothing on an app that is client-rendered anyway,
so the policy spends its strength elsewhere: `connect-src 'self'` blocks
exfiltration, `script-src 'self'` still refuses foreign script origins, and
`object-src` / `base-uri` / `form-action` / `frame-ancestors` close the usual
injection and clickjacking routes. There is no HTML-injection sink in this
codebase — no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` — so
React's escaping is the primary XSS defence and the CSP is the backstop.

The attack surface is mostly absent rather than defended. There are no API
keys to steal, no model budget to drain, no accounts to compromise and no
stored data to breach. One server route survives — `/api/geocode` — and it is
a thin proxy over Open-Meteo carrying a place name.

That route caps its query at 100 characters, strips control characters before
they reach an outbound request line, and is rate-limited to 60 lookups per
minute per IP so it cannot be used to hammer Open-Meteo from this app's
address. Its responses are `private` so a shared cache never holds a record of
where someone was about to say they were born. The limiter is in-memory and
therefore per warm instance — best-effort by design, meant to stop one client
being a nuisance, not to absorb a distributed flood. That belongs at the edge.

## What this is and isn't

The arithmetic here is real astronomy and can be checked against an ephemeris —
that is what the verification suites are for. What the app then says about it
is interpretation. The compatibility score in particular is a weighted
heuristic, not a measurement; the breakdown underneath it is where the
information actually is.
