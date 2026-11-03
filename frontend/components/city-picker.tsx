"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCity } from "@/lib/use-city";
import { popularCities } from "@/lib/ride-utils";

/**
 * City button for the header. Type any city or pick a suggestion.
 * The rides page then shows rides that pass through that city.
 * "All cities" shows every ride.
 */
export function CityPicker() {
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const save = (value: string) => {
    setCity(value.trim());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(city); // start the box with the saved city
      }}
    >
      {/* PopoverTrigger already renders a <button>, so it is styled directly */}
      <PopoverTrigger
        aria-label="Choose your city"
        className="inline-flex h-10 max-w-44 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-m-on-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-on-primary"
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">
          {city || "All cities"}
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
        >
          <div className="space-y-1">
            <label htmlFor="city-input" className="text-sm font-medium">
              Your city
            </label>
            <input
              id="city-input"
              list="city-options"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type or pick a city"
              autoComplete="off"
              className="h-10 w-full rounded-lg bg-m-surface-container px-3 text-sm text-m-on-surface outline-none placeholder:text-m-on-surface-variant focus:ring-2 focus:ring-m-primary"
            />
            <datalist id="city-options">
              {popularCities.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-xs text-m-on-surface-variant">
              Rides that pass through this city are shown first.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full bg-m-primary px-4 text-sm font-medium text-m-on-primary transition-colors hover:bg-m-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
            >
              Save city
            </button>
            <button
              type="button"
              onClick={() => save("")}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-m-outline px-4 text-sm font-medium text-m-primary transition-colors hover:bg-m-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
            >
              All cities
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
