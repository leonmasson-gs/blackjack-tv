# Daily Hand (blackjack-tv)

A two-minute daily blackjack decision quiz. Everyone gets the same five hands each day and chooses Hit, Stand or Double. Nothing is dealt afterwards, so luck cannot change the score. Each choice is scored against basic strategy, and the result settles the moment you finish.

Free to play. No money, chips or prizes. Status: **prototype**, not for public release (see "Before launch").

## Run it

```bash
python3 -m http.server 8000      # from the repo root, then open http://localhost:8000
```

Add `?debug` to the address to show the **reset my data** and **sample data preview** tools on the "How it's scored" page.

## Deploy

Vercel serves the repo as a plain static site. `index.html` is committed, so there is no build step.
In the Vercel project settings: Framework Preset **Other**, Build Command and Output Directory **blank**.
`vercel.json` sets security headers (including a Content-Security-Policy that only allows this site's own files) and `.vercelignore` keeps tests and tooling out of the deployment.

Push to the main branch for production. Every other branch gets a preview link.

## Change it

| To change | Edit | Then run |
|---|---|---|
| Page, copy, styling, game flow | `src/template.html` | `python3 scripts/build.py` |
| Rules or the hand pool | `engine/engine.py`, `engine/make_pool.py` | `python3 engine/make_pool.py && python3 scripts/build.py` |
| Turn streak off | `FEATURES.streak` near the top of the script in `src/template.html` | `python3 scripts/build.py` |

Commit `index.html` together with the source change.

## Check it

```bash
cd tests && npm install && npm test
```

That rebuilds the page, then runs: the game-logic tests, one test per persona finding (`tests/personas.test.js`), a comparison of every hand with the published basic-strategy chart, and a contrast check on the colour tokens. Takes a few seconds.

Optional real-browser check (downloads a Chromium build the first time):

```bash
cd tests/browser && npm install && npm run check      # add -- --quick for two widths, -- --shots to save screenshots
```

It opens every screen at 320, 360, 390, 768, 1024, 1280 and 1920px, with the same security headers as production, and fails if anything scrolls sideways, throws an error, if the fonts don't load, or if any text on screen is below WCAG contrast.

For the independent maths check (a few minutes, needs `numpy`): `python3 engine/mc_check.py`. It plays hands 1.5 million times each with its own dealer logic and compares the results with `engine.py`.

## How the maths works

- Ruleset: large-shoe approximation (infinite deck), dealer stands on all 17s and checks for blackjack, double on any two cards, no splits, no surrender, no doubling after a hit. Pairs are left out for now.
- `engine/engine.py` computes the expected value (average result per hand) of Hit, Stand and Double for each hand.
- Per hand score = 100 x (1 - value given away / gap between best and worst option), with a minimum gap of 0.15. The five hands are weighted 1, 1, 1.5, 1.5, 2. The percentage is a score out of 100, not a share of expected value.
- Any option within 0.01 of the best counts as right, and hands where two options are that close are left out of the pool (7 of them, including hard 16 against a 10).
- "Instinct trap" means the best play differs from a simple beginner's rule that we defined ourselves (`instinct()` in `engine/make_pool.py`).
- A bug in an earlier version (a soft hand that drew an Ace lost its "soft" flag) made every dealer-Ace hand wrong. It was caught by the independent simulation and fixed. Keep `mc_check.py` in the loop if the engine changes.

## Layout

One page, two layouts, chosen automatically by screen width (no setting for the player):

- **Under 960px (phones, tablets):** one column. Between 600 and 959px the column is wider (680px).
- **960px and up (laptops, desktops):** the home screen puts the text and button beside the card table. A hand shows the table on the left with the choices and explanation on the right, so it fits on one screen. The result screen puts the score and hand list beside the panels, and "Keep learning" runs full width underneath.

The breakpoints are the two `@media (min-width: ...)` blocks at the end of the CSS in `src/template.html`.

## Trivia and the daily hook

What keeps a player in the round, and gives them something after it:

| Where | What |
|---|---|
| Home screen | Today's first hand with Hit, Stand and Double right there. One tap answers it and starts the round. Plus a fact of the day. |
| Under each hand | A fact that fits the hand (a "why", a myth, or a number for that dealer card), then a **history story**. The day's five stories are picked at random, sorted oldest first, so the round tells a short history of cards and blackjack. |
| Result screen, "Keep learning" | A **bonus question** (not scored), the day's five stories recapped as a timeline, two more general facts, and "Blackjack by the numbers" (dealer bust rates, hit-bust chances, where the dealer finishes). |

Facts live in the `FACTS` list in `src/template.html` (39 entries, 9 of them history). Bonus questions are the `TQ` list (14 entries). Each has a `src`:

| `src` | Meaning |
|---|---|
| `engine` | computed from, or checked against, the engine (`tests/content.test.js` re-checks these against `data/pool.json`) |
| `review` | reasoning to be reviewed |
| `verify` | needs a source check before launch (12 facts and 5 questions are in this state, including every history item) |

Other fields: `type` (`why`, `myth`, `trivia`, `honest`, `history`), `sp` (prefer when the hand matches `when(h)`), `g` (makes sense with no hand on screen), and for history `y` (sort year) and `yr` (label shown). Seeding is by date, so everyone gets the same facts, stories and question each day.

About 39 facts means roughly a week before a regular player sees repeats. The cheapest way to extend it is more entries in `FACTS` and `TQ`; add a line to `tests/content.test.js` for anything with a number in it.

## What is and isn't built

| Built | Not built yet |
|---|---|
| Daily five from a 133-hand pool, scoring, per-hand explanations, facts, instinct traps, play styles | A backend (leaderboard and player percentages only work inside Claude today) |
| Result screen, share text, practice round, trivia (facts, history stories, bonus question, numbers) | Server-side scoring and a real one-play-a-day limit |
| Age gate (self-declared), nickname checks | Real age verification |
| Self-hosted fonts, no cookies, no third-party requests | Email sign-up (the button only records interest), invite links, partner offer |

The leaderboard and player percentages are written for Claude's shared storage and switch themselves off elsewhere. Replacing that with a real backend is the next job.

## Before launch

- Compliance decisions: the streak (switch above), the wording of verdicts, a named help line, public nicknames.
- Legal sign-off on the responsible gambling wording and the privacy notice (both are marked `[Placeholder ...]` on screen).
- Source-check the facts in the fact bank (`FACTS` in `src/template.html`; entries marked `verify` or `review`).
- Scores and answers currently live in the browser, and the answers are visible in the page source. A backend should score each answer, enforce the daily limit and expose only what the player needs.
- Hosted on a personal Vercel Hobby account and GitHub org. Move to a company account before it goes near partners.

## Layout

```
index.html        built page (committed; this is what Vercel serves)
fonts/            self-hosted fonts (SIL Open Font License, licences included)
src/template.html page source (HTML, CSS and JS in one file)
data/pool.json    generated hand pool with expected values
engine/           the maths: engine.py, make_pool.py, chart_check.py, mc_check.py
scripts/          build.py, contrast_check.py
tests/            logic, persona and content tests (jsdom), plus browser/ for the real-browser layout check
vercel.json       headers and routing
```
