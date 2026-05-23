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
