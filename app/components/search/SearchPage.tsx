"use client";

import { AdditionalFilters } from "@/components/search/AdditionalFilters.tsx";
import { FormValues } from "@/components/search/form.tsx";
import { TimeRangeFilters } from "@/components/search/TimeRangeFilters.tsx";
import { VehicleList } from "@/components/search/VehicleList.tsx";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/shared/ui/button";
import { Form } from "@/components/shared/ui/form";
import { Sheet, SheetContent, SheetTrigger } from "@/components/shared/ui/sheet";
import { roundToNearest30Minutes } from "@/lib/times.ts";
import { API } from "@/server/api";
import { addDays, addHours, format } from "date-fns";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useForm } from "react-hook-form";

const DATE_RANGE_STORAGE_KEY = "kw-search-date-range";

interface PersistedDateRange {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

function readPersistedDateRange(): PersistedDateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDateRange;
    // Drop if startDate is in the past (a day before today) — stale state
    const startDay = new Date(parsed.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDay < today) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SearchPage() {
  const filterOptions = API.getFilterOptions();

  const [defaults] = useState(() => {
    const persisted = readPersistedDateRange();
    const fallbackStart = roundToNearest30Minutes(addHours(new Date(), 1));
    const fallbackEnd = addDays(fallbackStart, 1);
    return {
      startDate: persisted ? new Date(persisted.startDate) : fallbackStart,
      startTime: persisted?.startTime ?? format(fallbackStart, "HH:mm"),
      endDate: persisted ? new Date(persisted.endDate) : fallbackEnd,
      endTime: persisted?.endTime ?? format(fallbackEnd, "HH:mm"),
    };
  });

  // Initialize form with default values
  const form = useForm<FormValues>({
    defaultValues: {
      startDate: defaults.startDate,
      startTime: defaults.startTime,
      endDate: defaults.endDate,
      endTime: defaults.endTime,
      minPassengers: 1,
      classification: filterOptions.classifications,
      make: filterOptions.makes,
      price: [10, 250],
    },
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!values.startDate || !values.endDate) return;
      try {
        window.sessionStorage.setItem(
          DATE_RANGE_STORAGE_KEY,
          JSON.stringify({
            startDate: values.startDate.toISOString(),
            startTime: values.startTime,
            endDate: values.endDate.toISOString(),
            endTime: values.endTime,
          }),
        );
      } catch {
        // Ignore storage write failures (quota, private mode, etc.)
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const filters = (
    <ErrorBoundary
      fallback={<ErrorFallback message="Failed to load filters" />}
    >
      <AdditionalFilters filterOptions={filterOptions} />
    </ErrorBoundary>
  );

  return (
    <Form {...form}>
      <div className="container mx-auto flex flex-col">
        <div className="grid grid-cols-12 grid-flow-row">
          <div className="pt-12 pb-4 border-b grid grid-cols-subgrid col-span-12 md:sticky top-0 bg-background/80 backdrop-blur-md z-10">
            <div className="px-4 flex items-end col-span-12 md:col-span-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Kaizen Wheels
              </h1>
            </div>
            <div className="px-4 col-span-12 md:col-span-9 mt-4 md:mt-0">
              <TimeRangeFilters />
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 px-4 md:py-8">
            <div className="md:hidden mt-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Filters</Button>
                </SheetTrigger>
                <SheetContent>{filters}</SheetContent>
              </Sheet>
            </div>
            <div className="hidden md:block">{filters}</div>
          </div>

          <div className="col-span-12 md:col-span-9 px-4 py-8">
            <ErrorBoundary
              fallback={<ErrorFallback message="Failed to load vehicles" />}
            >
              <VehicleList />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </Form>
  );
}
