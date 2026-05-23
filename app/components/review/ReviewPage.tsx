"use client"

import { VehicleDetails } from "@/components/review/VehicleDetails";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/shared/ui/button";
import { Separator } from "@/components/shared/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";
import { formatCents, formatCentsPrecise } from "@/lib/formatters";
import { API } from "@/server/api";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { MiniPageLayout } from "../shared/MiniPageLayout";

function Timeline({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  return (
    <div className="flex relative">
      <div className="absolute top-1.5 bottom-1.5 flex flex-col items-center">
        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white ring-1 z-10 ring-blue-400"></div>
        <div className="flex-grow border-l-2 border-dotted border-gray-300"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white ring-1 z-10 ring-blue-400"></div>
        <div className="flex-grow border-l-2 border-dotted border-gray-300"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white ring-1 z-10 ring-blue-400"></div>
      </div>
      <div className="flex flex-col justify-between gap-4 h-full ml-8">
        <div>
          <span className="text-sm text-gray-600">Pick-up</span>
          <p className="font-medium">{format(startDate, "PPpp")}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Rental period</p>
        </div>
        <div>
          <span className="text-sm text-gray-600">Drop-off</span>
          <p className="font-medium">{format(endDate, "PPpp")}</p>
        </div>
      </div>
    </div>
  );
}

function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (!id) {
    throw new Error("No reservation ID found");
  }

  const vehicle = API.getVehicle(id);

  const quote = API.getQuote({
    vehicleId: id,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  });

  const formattedDuration = formatDuration(
    intervalToDuration({
      start: startDate,
      end: endDate,
    }),
    { delimiter: ", " },
  );

  const hasDiscount = quote.discount !== null;
  const isHoliday = quote.discount?.kind === "holiday";
  const isLongRental = quote.discount?.kind === "long_rental";
  const discountTooltip = isHoliday
    ? "A 17% discount will be applied to the total price because your reservation includes a holiday."
    : isLongRental
      ? "A $10/hr discount has been applied to your hourly rate because your reservation is longer than 3 days."
      : null;

  return (
    <div className="flex flex-col gap-8">
      <VehicleDetails vehicle={vehicle} />

      <Separator />

      <div className="space-y-6">
        <h3 className="text-2xl font-semibold mb-4">Reservation Summary</h3>
        <div className="grid grid-cols-2 gap-6">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-600">Hourly Rate</dt>
              <dd className="flex items-center gap-2">
                {hasDiscount ? (
                  <>
                    <span className="text-sm text-gray-500 line-through">
                      {formatCents(quote.originalHourlyRateCents)}
                    </span>
                    <span className="text-lg text-green-700 font-medium">
                      {formatCentsPrecise(quote.effectiveHourlyRateCents)}
                    </span>
                    <span className="text-xs">/hr</span>
                    {discountTooltip && (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="Discount details"
                              className="text-green-700 hover:text-green-800"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-left">
                            {discountTooltip}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-lg">
                      {formatCents(vehicle.hourly_rate_cents)}
                    </span>
                    <span className="text-xs">/hr</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Duration</dt>
              <dd>{formattedDuration}</dd>
            </div>
            {hasDiscount && quote.discount && (
              <div>
                <dt className="text-sm text-gray-600">Discount</dt>
                <dd className="text-green-700">
                  {isHoliday && "Holiday discount (17% off total)"}
                  {isLongRental && "Multi-day discount ($10/hr off)"}
                  <span className="ml-2">
                    −{formatCentsPrecise(quote.discount.savingsCents)}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-600">Total Cost</dt>
              <dd className="flex items-baseline gap-2">
                {hasDiscount && (
                  <span className="text-base text-gray-500 line-through">
                    {formatCents(quote.originalTotalCents)}
                  </span>
                )}
                <span className="text-2xl font-medium tracking-tight">
                  {formatCentsPrecise(quote.totalPriceCents)}
                </span>
              </dd>
            </div>
          </dl>

          <Timeline startDate={startDate} endDate={endDate} />
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            toast.success(
              `Your reservation for the ${vehicle.make} ${vehicle.model} is confirmed!`,
            );
            router.push("/");
          }}
        >
          Confirm reservation
        </Button>
      </div>
    </div>
  );
}

export function ReviewPage() {
  return (
    <div>
      <div className="container max-w-2xl mx-auto pt-6 px-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to search
          </Link>
        </Button>
      </div>
      <MiniPageLayout
        title="Almost there"
        subtitle="Your adventure is about to begin! Please confirm your reservation below."
      >
        <ErrorBoundary
          fallback={<ErrorFallback message="Failed to load reservation" />}
        >
          <Content />
        </ErrorBoundary>
      </MiniPageLayout>
    </div>
  );
}
