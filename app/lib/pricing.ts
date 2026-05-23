import { DateTime } from "luxon";

export const HOLIDAYS_MMDD = [
  "01-21",
  "02-12",
  "03-04",
  "05-02",
  "06-16",
  "07-26",
  "08-03",
  "09-01",
  "11-05",
  "12-18",
] as const;

export const LONG_RENTAL_THRESHOLD_HOURS = 72;
export const LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS = 1000;
export const HOLIDAY_DISCOUNT_PERCENT = 17;

export type Discount =
  | {
      kind: "long_rental";
      perHourOffCents: number;
      savingsCents: number;
    }
  | {
      kind: "holiday";
      percent: number;
      savingsCents: number;
    };

export interface PricingResult {
  originalHourlyRateCents: number;
  effectiveHourlyRateCents: number;
  durationInHours: number;
  originalTotalCents: number;
  totalPriceCents: number;
  discount: Discount | null;
}

function isHolidayDate(d: DateTime): boolean {
  return HOLIDAYS_MMDD.includes(d.toFormat("MM-dd") as (typeof HOLIDAYS_MMDD)[number]);
}

function rangeIncludesHolidayButNotEndpoints(
  start: DateTime,
  end: DateTime,
): boolean {
  const startDay = start.startOf("day");
  const endDay = end.startOf("day");

  if (isHolidayDate(start) || isHolidayDate(end)) {
    return false;
  }

  let cursor = startDay.plus({ days: 1 });
  while (cursor < endDay) {
    if (isHolidayDate(cursor)) {
      return true;
    }
    cursor = cursor.plus({ days: 1 });
  }
  return false;
}

export function calculatePricing(input: {
  start: DateTime;
  end: DateTime;
  hourlyRateCents: number;
}): PricingResult {
  const { start, end, hourlyRateCents } = input;
  const durationInHours = Math.max(0, end.diff(start, "hours").hours || 0);
  const originalTotalCents = hourlyRateCents * durationInHours;

  const longRentalQualifies = durationInHours >= LONG_RENTAL_THRESHOLD_HOURS;
  const holidayQualifies = rangeIncludesHolidayButNotEndpoints(start, end);

  const longRentalEffectiveRate = Math.max(
    0,
    hourlyRateCents - LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS,
  );
  const longRentalTotal = longRentalEffectiveRate * durationInHours;
  const longRentalSavings = originalTotalCents - longRentalTotal;

  const holidayTotal = originalTotalCents * (1 - HOLIDAY_DISCOUNT_PERCENT / 100);
  const holidaySavings = originalTotalCents - holidayTotal;

  let discount: Discount | null = null;
  let effectiveHourlyRateCents = hourlyRateCents;
  let totalPriceCents = originalTotalCents;

  if (longRentalQualifies && holidayQualifies) {
    if (holidayTotal <= longRentalTotal) {
      discount = {
        kind: "holiday",
        percent: HOLIDAY_DISCOUNT_PERCENT,
        savingsCents: holidaySavings,
      };
      effectiveHourlyRateCents =
        hourlyRateCents * (1 - HOLIDAY_DISCOUNT_PERCENT / 100);
      totalPriceCents = holidayTotal;
    } else {
      discount = {
        kind: "long_rental",
        perHourOffCents: LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS,
        savingsCents: longRentalSavings,
      };
      effectiveHourlyRateCents = longRentalEffectiveRate;
      totalPriceCents = longRentalTotal;
    }
  } else if (holidayQualifies) {
    discount = {
      kind: "holiday",
      percent: HOLIDAY_DISCOUNT_PERCENT,
      savingsCents: holidaySavings,
    };
    effectiveHourlyRateCents =
      hourlyRateCents * (1 - HOLIDAY_DISCOUNT_PERCENT / 100);
    totalPriceCents = holidayTotal;
  } else if (longRentalQualifies) {
    discount = {
      kind: "long_rental",
      perHourOffCents: LONG_RENTAL_DISCOUNT_PER_HOUR_CENTS,
      savingsCents: longRentalSavings,
    };
    effectiveHourlyRateCents = longRentalEffectiveRate;
    totalPriceCents = longRentalTotal;
  }

  return {
    originalHourlyRateCents: hourlyRateCents,
    effectiveHourlyRateCents,
    durationInHours,
    originalTotalCents,
    totalPriceCents,
    discount,
  };
}
