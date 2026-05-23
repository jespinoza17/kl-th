import { formatCents, formatCentsPrecise } from "@/lib/formatters";
import { PricingResult } from "@/lib/pricing";
import { Vehicle } from "@/server/data";
import { useBase64Image } from "@/util/useBase64Image";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import { Card, CardTitle } from "@/components/shared/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";

export function VehicleListItem({
  vehicle,
  pricing,
  startDateTime,
  endDateTime,
}: {
  vehicle: Vehicle;
  pricing: PricingResult;
  startDateTime: Date;
  endDateTime: Date;
}) {
  const bookNowParams = new URLSearchParams({
    id: vehicle.id,
    start: startDateTime.toISOString(),
    end: endDateTime.toISOString(),
  });

  const imgData = useBase64Image(vehicle.thumbnail_url);

  const hasDiscount = pricing.discount !== null;
  const discountTooltip =
    pricing.discount?.kind === "holiday"
      ? "A 17% discount will be applied to the total price because your reservation includes a holiday."
      : pricing.discount?.kind === "long_rental"
        ? "A $10/hr discount has been applied to your hourly rate because your reservation is longer than 3 days."
        : null;

  return (
    <Card
      key={vehicle.id}
      className="flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 py-6"
    >
      <div className="max-w-[8rem] flex items-center mx-auto md:mx-0">
        <img src={imgData} alt={vehicle.make} className="w-full" />
      </div>
      <div className="w-full flex flex-col justify-center gap-2 lg:gap-4">
        <CardTitle className="text-lg font-semibold text-center md:text-left">
          {vehicle.make} {vehicle.model}
        </CardTitle>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 w-full text-center md:text-left">
          <div className="flex flex-col">
            <dt className="text-sm text-gray-600">Year</dt>
            <dd className="text-sm font-medium">{vehicle.year}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-gray-600">Class</dt>
            <dd className="text-sm font-medium">{vehicle.classification}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-gray-600">Passengers</dt>
            <dd className="text-sm font-medium">{vehicle.max_passengers}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-gray-600">Doors</dt>
            <dd className="text-sm font-medium">{vehicle.doors}</dd>
          </div>
        </dl>
      </div>
      <div className="md:ml-auto text-center md:text-right flex flex-col justify-center mt-4 md:mt-0">
        {hasDiscount ? (
          <div className="flex items-center justify-center md:justify-end gap-2">
            <span className="text-sm text-gray-500 line-through">
              {formatCents(pricing.originalHourlyRateCents)}
            </span>
            <p className="text-xl font-bold text-green-700">
              {formatCentsPrecise(pricing.effectiveHourlyRateCents)}
              <span className="text-sm text-gray-700 font-normal ml-0.5">
                /hr
              </span>
            </p>
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
          </div>
        ) : (
          <p className="text-xl font-bold">
            {formatCents(vehicle.hourly_rate_cents)}
            <span className="text-sm text-gray-700 font-normal ml-0.5">
              /hr
            </span>
          </p>
        )}
        <Button asChild className="mt-2 w-full sm:w-auto">
          <Link href={`/review?${bookNowParams.toString()}`}>Book now</Link>
        </Button>
      </div>
    </Card>
  );
}
