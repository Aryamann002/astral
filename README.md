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
| **Ask** | An astrologer with your full chart as context. |

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

`npm run verify:keys` and `npm run verify:failover` cover the Groq key pool —
env parsing, round-robin fairness, cooldown and backoff, and end-to-end
failover against a local stand-in for the Groq API.

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

Birth data lives in `localStorage` and charts are computed in the browser. It
leaves the device only if you use **Ask**, which sends a text summary of the
chart to the configured model provider.

## Configuration — the Groq key pool

Copy `.env.example` to `.env.local`. **Astral pools multiple Groq API keys**
and uses them round-robin, so several free-tier keys behave like one larger
quota. Supply them in whichever form is convenient — all three are read and
duplicates collapse:

```bash
GROQ_API_KEYS=gsk_first...,gsk_second...,gsk_third...   # list
GROQ_API_KEY=gsk_only...                                # single
GROQ_API_KEY_1=...  GROQ_API_KEY_2=...                  # numbered
```

What the pool does:

- **Spreads load** round-robin, so no single key absorbs the traffic.
- **Benches a throttled key** on a 429, for exactly as long as Groq's
  `retry-after` header or its "try again in 1.5s" message asks — then fails
  over to the next key mid-request, before a single token has been sent to the
  browser.
- **Disables an invalid key** on a 401/403 rather than retrying it forever.
- **Backs off further** each time the same key fails consecutively.
- **Steps over a dead model** without blaming the key: a decommissioned model
  returns a 4xx that has nothing to do with your credentials, so the pool moves
  down `GROQ_MODEL` → built-in candidates instead of benching a good key.
- **Never leaks a key** — logs, errors and diagnostics show `gsk_…a1b2` only.

Provider order is Groq → Vercel AI Gateway (if `AI_GATEWAY_API_KEY` is set) →
a deterministic local reader. The last one needs no credentials at all, so
`/api/chat` can never fail outright.

`GET /api/providers` reports live pool health — which keys are available,
which are cooling off and for how long, and their success/failure counts, all
masked.

### Why failover happens before streaming starts

`streamText` is lazy: it reports transport failures as an error *inside* the
stream rather than by throwing. Returning that response directly would mean a
rate limit only surfaced once the browser was already reading, far too late to
try another key. So the pool pulls from the stream until either real output
arrives (commit) or an error part does (fail over), then replays the consumed
chunks so nothing is lost at the seam. `npm run verify:failover` asserts
exactly that, against a local stand-in for the Groq API.

## What this is and isn't

The arithmetic here is real astronomy and can be checked against an ephemeris —
that is what the verification suites are for. What the app then says about it
is interpretation. The compatibility score in particular is a weighted
heuristic, not a measurement; the breakdown underneath it is where the
information actually is.
