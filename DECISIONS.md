# DECISIONS

## Part 1 — Price filter bug

### Root cause
The number `100` was being overloaded as a sentinel for "no upper limit" while *also* being a valid budget a user might pick.

- `app/components/search/AdditionalFilters.tsx` hard-capped the slider at `max={100}` and rendered the label as `"$100+"` when the upper handle hit the max — *implying* "100 or above."
- `app/server/api.ts` then rewrote `priceMax === 100` to `Number.MAX_SAFE_INTEGER` server-side.

Both customer complaints fell out of the same root cause:
- *"Hide above $125"* — impossible, slider physically couldn't reach 125.
- *"Budget is $100, seeing $220 cars"* — the moment the slider hit 100, the server treated it as "uncapped."

The catalog actually ranges from **$32/hr up to $220/hr**; the slider was set when the priciest car was ≤ $100 and never updated when more expensive vehicles were added. Instead of raising the cap, a `"+"` was glued to the label and a sentinel was added server-side — a Band-Aid that broke the literal-$100 case.

A contributing smell: the magic `100` was duplicated across the slider `max`, the label conditional, the reset-button predicate, and the server sentinel. Four hand-synced copies of the same constant is how the bug stayed alive.

### The fix (option 1 — minimal)
- `app/server/api.ts` — deleted the `priceMax === 100 ? MAX_SAFE_INTEGER : priceMax` sentinel. The server now honors whatever cap the client sends.
- `app/components/search/AdditionalFilters.tsx` — bumped slider `max` from `100` to `250` (covers the $220 ceiling with one step of headroom on the `step=10` grid). Removed the `"$100+"` label trick — the label now just renders the literal value.
- `app/components/search/SearchPage.tsx` — bumped the default upper `price` from `100` to `250` so the default search isn't silently hiding the $160/$170/$220 cars.
- Updated the matching `=== 100` check in the reset-button predicate to `=== 250` so "Reset all" still works.

Verified locally by driving `getAvailableVehicles` with `priceMax` values of 100, 125, 200, 250 — caps now match the value the user picks (`100` → tops out at $85, `200` → adds the $160/$170, `250` → returns everything including $220).

### Why option 1, not option 2
I considered making the slider `max` derived from the catalog (have `getFilterOptions()` return `maxHourlyRateCents` and let the slider compute `Math.ceil(maxRate / 10) * 10`). That eliminates the magic number forever and self-heals when new pricier vehicles get added — clearly the better long-term shape.

I'm shipping option 1 for now because the take-home is time-boxed and option 1 directly resolves both customer complaints with a tiny, low-risk diff. I'll come back to option 2 during the Part 3 refactor if there's time left after Part 2 — it's a natural fit, since the "magic constant duplicated across files" smell is exactly the kind of thing a refactor pass should clean up.

### Configurable?
Yes — even after option 1, slider min/max/step are still hardcoded constants. Option 2 makes them catalog-driven, which is the right end state. Until then, at minimum the constants should live in one shared place rather than being copy-pasted between the form component and the API handler.

---

## Part 2 — Discounts & pricing engine

### Shape: dedicated pricing module, not inline math in the API
Built `app/lib/pricing.ts` as a pure module exporting `calculatePricing()` instead of bolting the discount math onto `server/api.ts` next to the existing `calculateTotalPrice`. Two reasons:
- Pure functions of `(start, end, hourlyRateCents)` are trivial to unit test without standing up the API surface or mocking data.
- Both `searchVehicles` (list page) and `getQuote` (review page) need the same numbers. Co-locating the logic guarantees the list and the review page can't drift — a real risk if each call site computed its own discount.

The module owns four constants up top (`HOLIDAYS_MMDD`, `LONG_RENTAL_THRESHOLD_HOURS`, `LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS`, `HOLIDAY_DISCOUNT_PERCENT`) so the tunables are one find away.

### `PricingResult` shape: include the originals, not just the deltas
Returned `{ originalHourlyRateCents, effectiveHourlyRateCents, originalTotalCents, totalPriceCents, discount, durationInHours }`. The UI needs both the struck-through original and the discounted number; making the server hand back both keeps the client dumb and avoids re-deriving the original on render.

`discount` is a discriminated union (`{ kind: "holiday", percent, savingsCents }` | `{ kind: "long_rental", perHourOffCents, savingsCents }` | `null`) instead of a bag of optional fields. The narrow types fall out cleanly in JSX (`discount?.kind === "holiday"`), and the discriminator forces both branches to be considered at each call site.

### Holiday-window semantics: strictly between, not inclusive
The spec said *"includes a holiday but does not start or end on that holiday"*. Implemented `rangeIncludesHolidayButNotEndpoints` to walk every day strictly between start and end and check against the holiday list. Day-by-day iteration is fine for normal rentals; if reservations could span months, a smarter check would be warranted, but the YAGNI shape is correct for the actual product.

### Tie-breaker: holiday wins ties (`holidayTotal <= longRentalTotal`)
Spec says they can't both apply and "the discount with the best price applies." Equal-price ties are unspecified. Chose holiday-wins because:
- The 17% discount is the more product-flavored, narrative one ("you booked over a holiday").
- A percent discount stays correct as rates change; the $10/hr long-rental discount becomes a smaller proportional discount at higher rates.
- Picking either is fine for users (same price); picking deterministically is what matters for test stability.

### Threshold semantics: `>=`, not `>`
Spec read "more than 3 days" which is literally `> 72`. Shipped `>= 72`. Reasoning: 72-hour rentals are the natural round-number booking; excluding them feels like a worse user experience than the strict spec reading, and the user pulled me back to confirm this interpretation explicitly.

### Formatter split: `formatCents` vs `formatCentsPrecise`
Added `formatCentsPrecise` (2-decimal when fractional) instead of swapping every call site to a more-precise formatter. Whole-dollar formatting is right for headline prices; the precise variant is only needed for derived values like a 17% discount that produces fractional cents. Keeping both prevents a silent rounding regression across the existing UI.

### Holiday matching uses Luxon (not date-fns)
The codebase already had `luxon` for the existing `data.ts` helpers, and the day-by-day iteration is cleaner in Luxon's API. Could have used `date-fns` for consistency with the rest of the app, but the holiday list is `MM-dd` strings and matching against `d.toFormat("MM-dd")` reads better than `format(d, "MM-dd")`.

### What I'd revisit if I had more time
- No unit tests yet. The pure module is a perfect first test target; both tie-breaker branches should be pinned.
- The discount-row label strings ("Holiday discount (17% off total)", "Multi-day discount ($10/hr off)") and the tooltip strings live in the components rather than alongside the `Discount` union. If a third surface needs them, hoist them into `pricing.ts`.

---

## Part 3 — Refactor & UX polish

### Back-navigation state: `sessionStorage`, not URL params or React state
When the user clicks "Book now" then hits back, they expect their pickup/drop-off dates to still be there. Three options were on the table:

1. **URL search params on `/`** — push `?start=...&end=...` into the URL when the user changes dates. Survives a tab close, but every date tweak is a router push, the URL grows visual noise, and React-hook-form's state would need to be wired through Next's router.
2. **React state hoisted above both pages** — impossible without a layout/context refactor; not worth it for one form's worth of state.
3. **`sessionStorage`** — write on form change, hydrate on mount. Per-tab, survives client-side back-nav, dies when the tab closes (good — no stale dates surviving for days).

Went with (3). Hydration runs once in a `useState` initializer to avoid a flash of default-then-restored values. The persisted snapshot is dropped if `startDate < today` so a user returning hours/days later doesn't get a stale or in-the-past pickup time pre-filled.

Scope: only the four date/time fields are persisted, not the filter sidebar (price range, classifications, makes, passengers). That was the explicit ask; expanding to the rest is straightforward if the product wants it.

### Calendar UX: `defaultMonth={selected}` so re-opening the picker doesn't surprise you
The default behavior shows today's month regardless of what's selected — so picking June 15 then re-opening the popover lands on May. Set `defaultMonth={field.value}` on both Calendars; the existing `day_today` class still highlights today, so the visual cue isn't lost, but the picker opens where you'd expect.

### Auto-bump drop-off: exact `+24h`, not `+1 day`
When a new pickup is at-or-after the current drop-off, push drop-off to pickup + 24h. The initial instinct was to just bump `endDate` by one day, but pickup and drop-off can have different times of day stored separately — so bumping only the date can produce a 20-hour or 27-hour "24-hour rental." The fix sets both `endDate` and `endTime` so the resulting datetime is exactly 24h after the new pickup.

### Tooltip consistency: always show when a discount applies
The discount Info tooltip originally only rendered for `holiday`, so when both discounts qualified for a range and `long_rental` won the tie-breaker, the affected cars showed a discount with no explanation. Replaced the holiday-only conditional with a single `discountTooltip` string covering both kinds — same component, different copy per `discount.kind`. Done in both `VehicleListItem` and `ReviewPage` so the two surfaces stay aligned.

### Confirm reservation: real-feeling success UX without a real backend
The button was throwing `console.error("Not implemented")`. Took it to a real-feeling confirmation: `toast.success(...)` with the vehicle name, then `router.push("/")`. Picked `sonner` over rolling a custom toast or wiring `@radix-ui/react-toast` — one small dep, persists toasts across the navigation so the message survives the redirect, and it's the same pattern shadcn uses by default. Worth the ~30KB for the polish; worth re-evaluating if no other surface ends up needing toasts.

### Console statement cleanup
Removed both `console.*` calls — the `console.error("Not implemented")` on the Confirm handler (replaced by the success flow) and the `console.error(error)` in `searchVehicles`' catch block. The latter was legit observability for a silent-fallback path; in prod I'd want it back behind a logger, but for a take-home with no logger wired up, a stray `console.error` in the server bundle was the wrong shape.

### Small refactor: collapsed 3-layer `useState` chain in `SearchPage`
`initialStartDateAndTime` → `initialEndDateAndTime` → `defaults` was three nested initializers when one would do. Inlined the fallback math into the single `defaults` initializer. No behavior change, less code to read, fewer intermediate names to keep straight.

### What I'd revisit if I had more time
- Hoist the discount tooltip / discount-row label strings into `pricing.ts` (already a follow-up from Part 2 — Part 3 added a second call site but didn't yet justify the extraction).
- Expand sessionStorage persistence to the rest of the search filters if the product wants full back-nav restoration, not just dates.
- Wire a real logger so the server-side error path has observability without a stray `console.error`.
