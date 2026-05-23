# AI_LOG

A running log of how AI tools were used throughout this take-home assignment.
Each entry captures **what** was done, **how AI was used**, and any **notes / decisions / tradeoffs**.

---

## Tooling

- **Primary assistant:** Claude (Opus 4.7) via Claude Code, running inside Conductor
- **Style of use:** pair-programming — I drive the requirements, AI executes and proposes; I review every change before commit

---

## Timeline

### Session start — 2026-05-22

**Goal:** Get the project running locally and set up the repo for the assignment.

- Verified the workspace contents and `package.json` (Next.js 16.1.6, React 18, Tailwind, Radix UI, react-hook-form, zod, luxon).
- Installed dependencies with `npm install` (227 packages).
- Started the dev server (`npm run dev`) and confirmed `GET / → 200` rendering the "Kaizen Wheels" homepage.
- Added `.gitignore` covering `node_modules/`, Next.js build caches (`.next/`, `out/`), env files, logs, OS/editor cruft, and TypeScript build info.
- Initialized this `AI_LOG.md` to document AI usage across the assignment.

**AI usage:** Claude handled the install/run verification, drafted the `.gitignore`, and scaffolded this log file. All commands and file contents were reviewed before commit.

**2-hour timer started at commit time.**

---

### Part 1 — Price filter bug — 2026-05-22

**Goal:** Diagnose the user reports ("can't hide above $125", "budget is $100 but seeing $220 cars") and ship a fix.

**How I used AI:**
- Asked Claude to find the root cause and propose options *before* writing any code. I deliberately did not ask for "the fix" — I wanted the diagnosis and tradeoffs first, so I could pick the right shape rather than rubber-stamp whatever it produced.
- Claude pulled up `AdditionalFilters.tsx` and `api.ts`, identified that `100` was being overloaded as both a literal price *and* a "no cap" sentinel, and proved it by reading the catalog data (rates from $32 to $220) to show why `$100+` was a Band-Aid covering missing slider range.
- Claude proposed three options ranked by scope: (1) raise the cap and drop the sentinel, (2) derive the cap from the catalog via `getFilterOptions()`, (3) explicit "uncapped" toggle. I chose option 1 for speed and parked option 2 as a Part 3 refactor candidate.

**What got shipped:**
- `app/server/api.ts` — deleted the `priceMax === 100 ? MAX_SAFE_INTEGER` sentinel.
- `app/components/search/AdditionalFilters.tsx` — slider `max` `100 → 250`, removed the `"$100+"` label, updated the reset-button predicate.
- `app/components/search/SearchPage.tsx` — default upper `price` `100 → 250` so default search no longer hides the $160/$170/$220 cars.
- `DECISIONS.md` initialized with the root-cause writeup, the fix, and the rationale for option 1 over option 2.

**Verification:**
- I had Claude write a one-off tsx script that drove `getAvailableVehicles` with `priceMax` of 100/125/200/250 and printed the resulting rates. `priceMax=100` now tops out at $85 (not $220), `priceMax=125` is expressible, `priceMax=200` correctly adds the $160 and $170 cars without the $220. This is the verification I cared about — `npm run ts` only proves compilation, not behavior.
- `npm run ts` clean, dev server hot-reloaded, `GET / → 200`.

**Where I pushed back / made the call myself:**
- Picked option 1 even though Claude's option 2 is the cleaner long-term shape — judgment call on time vs. scope.
- I noticed Claude initially didn't mention the default `price: [10, 100]` in `SearchPage.tsx`. Without bumping that too, the default search would silently hide every car over $100 after the slider bump — a subtle regression. I caught it because the catalog-rate audit made me think about defaults.

**Notes / follow-ups:**
- The magic number `100` was duplicated in 4 places (slider `max`, label conditional, reset predicate, server sentinel). Option 2 in Part 3 should consolidate to a single source of truth — ideally catalog-derived.

---

## Template for future entries

### <task / feature name> — <date / elapsed time>

**Goal:** <what we were trying to accomplish>

**AI usage:**
- <prompts or directions given>
- <what the AI produced>
- <what I changed / accepted / rejected and why>

**Notes:** <tradeoffs, follow-ups, things to revisit>
