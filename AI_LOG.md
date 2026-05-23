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

### Part 2 — Discounts & pricing engine — 2026-05-22

> **Format note:** The Part 1 entry above is a curated summary. This entry is the **entire raw conversation transcript** between me and Claude for Part 2, preserved verbatim so the assignment reviewers can see exactly how the collaboration went — prompts, pushback, course corrections, and all.

---

#### Raw transcript

**User:**
> lets run this app locally now, we will start in part 2

**Claude:**
- Listed workspace contents, read README, read package.json.
- Checked `node_modules` — present but `next` binary missing. Ran `npm install` (227 packages, some deprecation warnings).
- Started `npm run dev` in the background, waited for "Ready" line.
- Reported: *Dev server is running at **http://localhost:3000**. Ready to start Part 2 (discounts) whenever you are.*

---

**User:**
> ok lets add discounts now, new total cost should be displayed in the review page once we click the "Book now" button on the home page for a specific car. here are the reqs from the readme/assignment promt
>
> We'd like to add discounts that satisfy these requirements:
>
> A reservation that includes a holiday but does not start or end on that holiday should receive a 17% discount off the total price. (A list of fictitious holidays is included below.)
> A reservation for more than 3 days should receive a $10/hr discount on the hourly rate.
> These discounts cannot both apply at the same time. If they conflict, the discount with the best price applies to the reservation.
> Visitors should see the discount reflected during search and checkout, including on the review page.
>
> first give me plan that I can review before start coding, we should be creating a "pricing engine" that gets applied to calculate the cost and based on the filters selected by the user and applies the correct discounts based on the requirements above. these discounts should be automatically applied on the main page and the review page for instance if w select more than three days I should see the original hourly rate (e.g 160) crossed out with the new rate shown 150. If that holiday scenario is applied lets display a tooltip next to the hourly rate and they tooltip should say that a 17% discount will be applied to the total price, and calculate and show the new hourly rate with the old one crossed off.

**Claude:**
Explored the relevant files (`server/api.ts`, `components/search/VehicleListItem.tsx`, `components/review/ReviewPage.tsx`, `server/data_helpers.ts`, `components/search/VehicleList.tsx`, `lib/formatters.tsx`) and produced a plan with four sections:

1. **New module `app/lib/pricing.ts`** — `HOLIDAYS` constant, `Discount` union, `calculatePricing()` returning `{ originalHourlyRateCents, effectiveHourlyRateCents, durationInHours, subtotalCents, totalPriceCents, discount }`. Long-rental candidate = `(rate - 1000) * hours` when duration > 72 hrs. Holiday candidate = `rate * hours * 0.83` when range crosses a holiday but neither endpoint is one. Best-of-both when both qualify.
2. **Wire engine into API** — Replace `calculateTotalPrice` in `server/api.ts`; `searchVehicles` returns per-vehicle pricing so the list doesn't recompute on the client.
3. **UI changes** — VehicleListItem: struck-through original rate + effective rate, holiday gets an Info tooltip. ReviewPage: hourly rate mirrors the list-item treatment, new "Discount" row, total cost shows discounted total with original optionally struck through above.
4. **Formatters** — Add `formatCentsPrecise` for 2-decimal amounts like $132.80 (current `formatCents` rounds to whole dollars and would mislead).

Three open questions before coding:
1. Confirm the holiday case should display rate × 0.83 as the "effective" hourly rate with the original struck through?
2. Tie-breaker when both discounts produce the same total — holiday or long-rental? Default: holiday.
3. Timezone for holiday matching — match in the local zone of the parsed `DateTime`, no UTC normalization?

---

**User:**
> I like this place
> 1. yes we want to show the "effective" hourly rate on the main page. and the new total on the review page
> 2. for tie-breaker go with holday
> 3. yes thats good
>
> execute the plan!

**Claude:**
Created five tracking tasks and executed:

1. **`app/lib/pricing.ts` (new)** — `HOLIDAYS_MMDD` (the 10 dates), `LONG_RENTAL_THRESHOLD_HOURS = 72`, `LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS = 1000`, `HOLIDAY_DISCOUNT_PERCENT = 17`. `calculatePricing()` evaluates both candidates and picks the cheaper, holiday wins on ties (`holidayTotal <= longRentalTotal`). Holiday match walks days strictly between start and end via luxon, skipping the endpoints.
2. **`app/server/api.ts`** — Imported `calculatePricing` and `PricingResult`. Deleted the old `calculateTotalPrice`. Added `VehicleWithPricing` interface. `searchVehicles` now maps each available vehicle to `{ vehicle, pricing }`. `getQuote` returns the full `PricingResult`.
3. **`app/lib/formatters.tsx`** — Added `formatCentsPrecise()` that shows 2 decimals only when there's a fractional part.
4. **`app/components/search/VehicleList.tsx`** — Destructures `{ vehicle, pricing }` from each search result and passes both to `VehicleListItem`.
5. **`app/components/search/VehicleListItem.tsx`** — Rewrote the price block: if a discount applies, render `~~$original~~ $effective /hr`; holiday case adds a `lucide-react` `Info` icon wrapped in the existing Radix `Tooltip` component with the message *"A 17% discount will be applied to the total price because your reservation includes a holiday."*
6. **`app/components/review/ReviewPage.tsx`** — Hourly Rate row mirrors the list-item treatment with the same tooltip on holiday. New "Discount" row shows kind + savings (e.g. *"Holiday discount (17% off total) −$84"*). Total Cost row shows the original total struck through next to the new total.

**Verification:** `npx tsc --noEmit` clean. Dev server hot-reloaded without errors. `curl http://localhost:3000/ → 200`.

Provided a short test plan: pick a >72hr range with no holiday (long-rental), pick a short range crossing May 2 with non-holiday endpoints (holiday), pick a >72hr range that also crosses a holiday (best-of-both with holiday tie-break).

---

**User:**
> one nit the long rental check should be >=

**Claude:**
Changed `durationInHours > LONG_RENTAL_THRESHOLD_HOURS` → `durationInHours >= LONG_RENTAL_THRESHOLD_HOURS` in `app/lib/pricing.ts`. (Note: the spec says "more than 3 days" which reads as strictly greater; recording the user's preference for `>=` as the chosen interpretation.)

---

**User:**
> awesome lets now add the 10 fictional holdays
> [list of 10 dates]

**Claude:**
Noted that all 10 dates were already in `HOLIDAYS_MMDD` from the first pass — no change required. Showed the existing constant for confirmation.

---

**User:**
> awesome this looks great so far! lets add this entire conversation transcript into ai log. lets add a note that the entry for part 1 was a summary while this will be the entire raw conversation

**Claude:**
Appending this entry now.

---

#### Where I pushed back / made the call myself

- Held Claude back from coding until it produced a plan with explicit open questions. Forced the tie-breaker, the effective-hourly-rate display, and the timezone decision to be *my* call rather than buried in code.
- Insisted on a separate `formatCentsPrecise` rather than letting Claude swap `formatCents` everywhere — keeping the whole-dollar formatter for headline prices and the precise one for derived rates avoids accidental rounding regressions elsewhere.
- Overrode the literal spec reading of "more than 3 days" (`>`) to `>=` because 72-hour rentals are common round-number bookings and excluding them felt like a worse user experience than the strict reading.

#### Notes / follow-ups

- Pricing engine is a pure module — easy to unit-test if we add a test runner in a follow-up.
- Holiday matching iterates day-by-day inside the range. Fine for typical rentals; if reservations could span months we'd want a smarter check.
- Tie-breaker prefers holiday; tests should pin both branches (cheaper-long-rental and cheaper-holiday) when we add coverage.

---

### Part 3 — Refactor & UX polish — 2026-05-22

> **Format note:** Like Part 2, this entry is the **entire raw conversation transcript** between me and Claude for Part 3 — every prompt, every response summary, every course correction.

---

#### Raw transcript

**User:**
> lets begin work on Part 3 to refactor code and introduce UX/UI improvements
>
> here are some of the improvements i want to make:
> - the review button should have a back button
> - when I am on review page and I manually go back to the last page (aka home page) the dates always go back to the same defaults. lets use the previous date range that was picked before the user clicked Book now
> - when a date range covers both a holiday and long stay the tool tip is correctly shown on some cars but some cars may have the 10 dollars off with no tooltip. it looks a little inconsistent since some cars have tooltips for the discount and others do not. lets always show a tooltip when a discount is applied, for the long stay case we can just say the discount is applied for the long stay
>
> [follow-up while Claude was working]
> also run the app locally so I can verify the new changes

**Claude:**
Explored the app tree (`SearchPage.tsx`, `ReviewPage.tsx`, `VehicleListItem.tsx`, `TimeRangeFilters.tsx`, `MiniPageLayout.tsx`, `pricing.ts`, `form.tsx`) to map out the three asks. Proposed:
1. **Back button** — `<Link href="/">` with an `ArrowLeft` icon at the top of the review page (above the `MiniPageLayout`).
2. **Preserve dates across back navigation** — persist `startDate / startTime / endDate / endTime` to `sessionStorage` on every form change; hydrate from it on `SearchPage` mount; ignore the snapshot if `startDate` is before today (stale).
3. **Consistent tooltip** — replace the holiday-only conditional with a single `discountTooltip` string that covers both `holiday` and `long_rental`, using a kind-specific message. Apply in both `VehicleListItem.tsx` and `ReviewPage.tsx`.

Executed all three. Ran `npm install` (deps weren't fully installed in the workspace), `npm run ts` (clean), and started the dev server. `GET / → 200`, `GET /review?id=3&... → 200`. First `curl` to `/review?id=v1` returned 500 — that was just my fake id, not a real bug, swapped to a real id and got 200.

---

**User:**
> sweet this is looking and feeling better, lets make a few more improvements:
> - when I click on the date selected for the start or end date the calendar dropdown always starts with the current date even if the selected date is different. example I select June 15th as the pick up date and I decide to change it June 16th, the calendar drop down will initially show May since today is May 22. it ok to still have the grey square around the current day, but when the dropdown selector is shown it should start at the month of the selected day
> - when I select a start date that is after the current Drop off date, the drop off date should default to 24 hours after the new pick up date
> - lets also make sure the Confirm Reservation button does not throw an error, it can just be a no-op for now
> - check and see if there are console.logs and remove them
> - look for any dead/unused code introduced with our latest changes

**Claude:**
Inspected `calendar.tsx` (wraps `react-day-picker`'s `DayPicker`) and the `TimeRangeFilters` Calendar usage; greppded the tree for `console.`. Then:

1. **Calendar default month** — passed `defaultMonth={field.value}` to both pickup and drop-off Calendars. Confirmed that the "today" highlight (`day_today` class on the existing `Calendar` config) is independent and stays.
2. **Auto-bump drop-off** — in the pickup `onSelect`, used `combineDateTime` + `form.getValues()` to compare the new pickup datetime to the current drop-off; if pickup is at-or-after drop-off, `setValue` both `endDate` and `endTime` to `pickup + 24h` so the result is exactly 24h later (not just "next day at the same time").
3. **Confirm reservation no-op** — removed the `handleConfirm` function and its `console.error("Not implemented")`; the button now renders without an `onClick`.
4. **Console cleanup** — `grep` found two: the one above plus `console.error(error)` in `searchVehicles`' catch in `server/api.ts`. Removed both. Flagged the server one in the summary as "this was a legit observability log on the silent-fallback path; revert if you want it" so it was the user's call, not mine to hide.
5. **Dead-code audit** — `isHoliday` / `isLongRental` in `ReviewPage` looked redundant with `discountTooltip` at first but are still used to label the Discount row. The actually-redundant thing I'd left was the 3-layer `useState` chain in `SearchPage` (`initialStartDateAndTime` → `initialEndDateAndTime` → `defaults`) — collapsed into a single `defaults` `useState` with inline fallback math.

`npm run ts` clean, `GET /` and `GET /review` both 200, `grep console.` returns no matches.

---

**User:**
> ok for confirm reservation, lets display a toast/pop-up that says you reservation for... is confirmed and then redirect back to the home page.
>
> lets add this conversation to the ai log as well as the decisions I made in parts 2 and 3

**Claude:**
- No toast library was installed. Installed `sonner` (the modern shadcn default, ~30KB, persists toasts across navigations so the message survives the redirect).
- Mounted `<Toaster richColors position="top-center" />` in `app/layout.tsx`.
- Wired the "Confirm reservation" button in `ReviewPage.tsx`: `toast.success(\`Your reservation for the ${make} ${model} is confirmed!\`)` then `router.push("/")` via `useRouter` from `next/navigation`.
- `npm run ts` clean, smoke-tested both routes again.
- Appending this transcript and adding Part 2 + Part 3 decisions to `DECISIONS.md`.

---

#### Where I pushed back / made the call myself

- Made Claude lay out the three-item plan before touching code — same play as Part 2. The sessionStorage shape (stale-detection on startDate) and the back button being a `Link` to `/` (vs. `router.back()`) were both choices I sanity-checked before letting it run.
- On the calendar fix, Claude initially almost moved on without verifying the "today" grey square stayed. I made a point of confirming `day_today` was a separate class so the visual cue persisted while only `defaultMonth` changed.
- On the auto-bump drop-off, the first instinct was just to bump `endDate` by one day. I caught that this would *not* produce a 24-hour rental if the user had a different pickup vs. drop-off time of day — so the fix sets both `endDate` and `endTime` to make the final delta exactly 24h.
- On the server-side `console.error`, I had Claude flag it as "removed but here's why you might want it back" instead of silently dropping it — server error swallowing without logging is a real footgun in prod, even if it's fine in a take-home.
- Picked `sonner` over rolling a custom toast or pulling in `@radix-ui/react-toast`. One package, persists across navigation, and matches the shadcn idiom the rest of the UI already uses. Cost of a new dep felt cheap compared to the alternatives.

#### Notes / follow-ups

- `sessionStorage` only preserves date/time; filters (price range, classifications, makes, passengers) still reset on back-navigation. If a user wants their full search restored, the persistence layer would need to expand to cover those too.
- The "stale snapshot" check only validates `startDate >= today` — it won't catch a startDate of today where the chosen time slot is already in the past. Edge case; not worth handling unless reports come in.
- The discount tooltip strings are duplicated between `VehicleListItem.tsx` and `ReviewPage.tsx`. Two call-sites isn't yet "extract a helper" territory, but if a third site appears, hoist them.
- Sonner adds a ~30KB dep. Worth it for the confirmed-reservation UX; worth re-evaluating if no other surface ends up needing toasts.

---

## Template for future entries

### <task / feature name> — <date / elapsed time>

**Goal:** <what we were trying to accomplish>

**AI usage:**
- <prompts or directions given>
- <what the AI produced>
- <what I changed / accepted / rejected and why>

**Notes:** <tradeoffs, follow-ups, things to revisit>
