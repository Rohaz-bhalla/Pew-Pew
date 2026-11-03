/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarIcon,
  Car,
  Check,
  Clock,
  Plus,
  Search,
  Users,
  X,
  Zap,
} from "lucide-react";

import { toast } from "@/components/ui/toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuthFetch, failMessage } from "@/lib/use-auth-fetch";
import { useRole } from "@/lib/use-role";
import {
  routeMatch,
  rupees,
  vehicles,
  type Ride,
  type VehicleType,
} from "@/lib/ride-utils";
import {
  RideRow,
  RideTicket,
  type RideCardProps,
} from "@/components/ride-cards";

// Colors, radii and font come from the theme tokens in globals.css.

const fieldClass =
  "h-12 w-full rounded-lg bg-m-surface-container px-4 text-base text-m-on-surface outline-none placeholder:text-m-on-surface-variant focus:ring-2 focus:ring-m-primary";
const noSpin =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const btnFilled =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-m-primary px-6 text-base font-medium text-m-on-primary transition-colors hover:bg-m-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary disabled:cursor-not-allowed disabled:bg-m-disabled disabled:text-m-on-disabled";
const errorText = "mt-1 px-1 text-xs text-m-error";

// Backend stores LocalDateTime (no time zone), so we send local time like 2026-11-02T09:00:00.
const toLocalIso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");

// An empty box becomes "undefined" instead of NaN
const toNumber = (val: unknown) =>
  val === "" ||
  val === undefined ||
  val === null ||
  (typeof val === "number" && Number.isNaN(val))
    ? undefined
    : Number(val);

// Define Zod Schema for Ride Creation
const rideSchema = z
  .object({
    origin: z
      .string()
      .min(2, { message: "Origin must be at least 2 characters." }),
    destination: z
      .string()
      .min(2, { message: "Destination must be at least 2 characters." }),
    vehicleType: z.enum(["CAR", "E_RICKSHAW"]),
    totalFare: z.preprocess(
      toNumber,
      z
        .number({ message: "Enter the total fare in rupees." })
        .positive({ message: "Fare must be more than 0." }),
    ),
    availableSeats: z.preprocess(
      toNumber,
      z
        .number({ message: "Enter how many riders you can take." })
        .int()
        .min(1, { message: "Must offer at least 1 seat." }),
    ),
    // Optional: lowest price per person the driver would accept
    minPrice: z.preprocess(
      toNumber,
      z.number().positive({ message: "Must be more than 0." }).optional(),
    ),
    departureTime: z
      .string()
      .min(1, { message: "Departure date is required." }),
  })
  .superRefine((data, ctx) => {
    const vehicle = vehicles[data.vehicleType];
    if (data.availableSeats > vehicle.maxSeats) {
      ctx.addIssue({
        code: "custom",
        path: ["availableSeats"],
        message: `${vehicle.label} fits up to ${vehicle.maxSeats} riders.`,
      });
      return;
    }
    const perPerson = Math.ceil(data.totalFare / data.availableSeats);
    if (data.minPrice !== undefined && data.minPrice >= perPerson) {
      ctx.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: `Must be less than ${rupees(perPerson)}, the per-person price.`,
      });
    }
  });

type RideFormInput = z.input<typeof rideSchema>;
type RideFormOutput = z.output<typeof rideSchema>;

/** Route rail marks for the post form: dot (start), ring (stop), square (end). */
function RailMarks({ position }: { position: "start" | "stop" | "end" }) {
  return (
    <>
      {position !== "start" && (
        <span
          aria-hidden
          className="absolute left-4.25 top-0 h-6 w-px bg-m-primary"
        />
      )}
      {position !== "end" && (
        <span
          aria-hidden
          className="absolute -bottom-2 left-4.25 top-6 w-px bg-m-primary"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute left-3.25 top-4.75 h-2.5 w-2.5",
          position === "start" && "rounded-full bg-m-primary",
          position === "stop" &&
            "rounded-full border-2 border-m-primary bg-m-surface-low",
          position === "end" && "bg-m-primary",
        )}
      />
    </>
  );
}

const tabs = [
  { id: "all", label: "All rides" },
  { id: "mine", label: "Posted by me" },
  { id: "bookings", label: "My bookings" },
] as const;

export default function RidesPage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const driverName = user?.fullName || user?.username || "Anonymous Driver";
  const clerkUserId = user?.id || "";
  const authFetch = useAuthFetch(); // fetch + login token
  const { role } = useRole(); // "rider" | "driver" | null

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "mine" | "bookings">(
    "all",
  );
  const [stops, setStops] = useState<string[]>([]);
  const [timeOfDay, setTimeOfDay] = useState("09:00");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RideFormInput, any, RideFormOutput>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      origin: "",
      destination: "",
      vehicleType: "CAR",
      totalFare: "" as unknown as number,
      availableSeats: "" as unknown as number,
      minPrice: "" as unknown as number,
      departureTime: "",
    },
  });

  // Live "₹1000 per person" preview
  const vehicleType = (watch("vehicleType") || "CAR") as VehicleType;
  const fareValue = Number(watch("totalFare"));
  const seatsValue = Number(watch("availableSeats"));
  const perPersonPreview =
    fareValue > 0 && seatsValue > 0 ? Math.ceil(fareValue / seatsValue) : null;

  const fetchRides = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rides`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setRides(data);
    } catch (err) {
      console.error("Failed to fetch rides:", err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRides();
  }, [fetchRides]);

  const onSubmit = async (data: RideFormOutput) => {
    if (!isSignedIn) {
      toast.add({
        type: "error",
        description: "You must be signed in to post a ride!",
      });
      return;
    }

    setSubmitting(true);
    const newRide = {
      ...data,
      driverName,
      stops: stops.map((s) => s.trim()).filter(Boolean),
    };

    try {
      const res = await authFetch(`${API_URL}/api/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRide),
      });

      if (res.ok) {
        reset();
        setStops([]);
        fetchRides();
        toast.add({
          type: "success",
          description: "Ride published successfully! 🚗",
        });
      } else {
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            await res.text(),
            "Failed to publish ride",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to create ride:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookSeat = async (rideId: number) => {
    if (!isSignedIn) {
      toast.add({
        type: "error",
        description: "Please sign in to book a seat!",
      });
      return;
    }

    try {
      const res = await authFetch(
        `${API_URL}/api/rides/${rideId}/book?passengerName=${encodeURIComponent(driverName)}`,
        { method: "PUT" },
      );

      if (res.ok) {
        fetchRides();
        toast.add({
          type: "success",
          description: "You have successfully booked a seat. 🎉",
        });
      } else {
        const errorText = await res.text();
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            errorText,
            "Failed to book seat",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to book seat:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleCancelBooking = async (rideId: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/rides/${rideId}/cancel`, {
        method: "PUT",
      });

      if (res.ok) {
        fetchRides();
        toast.add({
          type: "info",
          description: "Booking cancelled successfully. Seat freed up.",
        });
      } else {
        const errorText = await res.text();
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            errorText,
            "Failed to cancel booking",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleDeleteRide = async (rideId: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/rides/${rideId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchRides();
        toast.add({
          type: "info",
          description: "Your ride listing has been removed.",
        });
      } else {
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            await res.text(),
            "Failed to delete ride",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to delete ride:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  // 1. Tabs
  const tabRides = rides.filter((ride) => {
    if (activeTab === "mine") return ride.driverClerkId === clerkUserId;
    if (activeTab === "bookings") {
      return ride.passengerClerkIds?.includes(clerkUserId);
    }
    return true;
  });

  // 2. "I am going from X to Y": rides on that route, and rides going the same way
  const exactRides = tabRides.filter(
    (r) => routeMatch(r, fromFilter, toFilter) === "exact",
  );
  const similarRides =
    activeTab === "all"
      ? tabRides.filter(
          (r) => routeMatch(r, fromFilter, toFilter) === "same-destination",
        )
      : [];

  const renderCard = (ride: Ride) => {
    const isBooked = ride.passengerClerkIds?.includes(clerkUserId);
    const props: RideCardProps = {
      ride,
      isOwner: !!isSignedIn && ride.driverClerkId === clerkUserId,
      fare: ride.passengerFares?.[clerkUserId] ?? ride.price,
      formattedDate: ride.departureTime
        ? format(new Date(ride.departureTime), "PPP, p")
        : null,
      onOpen: () => router.push(`/rides/${ride.id}`),
      onBook: () => handleBookSeat(ride.id),
      onCancel: () => handleCancelBooking(ride.id),
      onDelete: () => handleDeleteRide(ride.id),
    };
    return isBooked ? (
      <RideTicket key={ride.id} {...props} />
    ) : (
      <RideRow key={ride.id} {...props} />
    );
  };

  return (
    <div className="font-m min-h-[calc(100svh-4rem)] bg-m-surface pb-16 text-m-on-surface">
      {/* Top band */}
      <header className="rounded-b-m-sheet bg-m-primary px-6 pb-20 pt-10 text-m-on-primary">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-m-on-primary text-m-primary">
            <Car className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Carpool</h1>
            <p className="text-sm opacity-80">
              Offer a seat or find a ride for your commute.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-4xl space-y-8 px-4">
        {/* Post a ride (hidden in rider mode) */}
        {role === "rider" ? (
          <section
            id="post-ride"
            className="flex flex-col gap-4 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold">Looking for a ride?</h2>
              <p className="text-m-on-surface-variant">
                You are in rider mode. Pick a ride below to book a seat.
              </p>
            </div>
            <Link
              href="/console"
              className="inline-flex h-10 items-center justify-center rounded-full border border-m-outline px-6 text-sm font-medium text-m-primary transition-colors hover:bg-m-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
            >
              Switch to driver
            </Link>
          </section>
        ) : (
          <section
            id="post-ride"
            className="scroll-mt-6 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6 shadow-sm sm:p-8"
          >
            <h2 className="mb-5 text-2xl font-semibold">Post a ride</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Vehicle: pool car or e-rickshaw */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(vehicles) as VehicleType[]).map((key) => (
                  <label key={key} className="relative">
                    <input
                      type="radio"
                      value={key}
                      className="peer sr-only"
                      {...register("vehicleType")}
                    />
                    <span className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-m-outline text-sm font-medium text-m-on-surface transition-colors hover:bg-m-surface-container peer-checked:border-transparent peer-checked:bg-m-primary-container peer-checked:text-m-on-primary-container peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-m-primary">
                      {key === "CAR" ? (
                        <Car className="h-4 w-4" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {vehicles[key].label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Origin, optional stops, destination — with route rail */}
              <div>
                <div className="space-y-2">
                  <div className="relative">
                    <RailMarks position="start" />
                    <input
                      type="text"
                      placeholder="Origin (e.g. Amritsar)"
                      className={cn(fieldClass, "pl-10")}
                      {...register("origin")}
                    />
                  </div>

                  {stops.map((stop, i) => (
                    <div key={i} className="relative">
                      <RailMarks position="stop" />
                      <input
                        type="text"
                        value={stop}
                        placeholder={`Stop ${i + 1} (e.g. Ludhiana)`}
                        aria-label={`Stop ${i + 1}`}
                        onChange={(e) =>
                          setStops((prev) =>
                            prev.map((s, j) => (j === i ? e.target.value : s)),
                          )
                        }
                        className={cn(fieldClass, "pl-10 pr-12")}
                      />
                      <button
                        type="button"
                        aria-label={`Remove stop ${i + 1}`}
                        onClick={() =>
                          setStops((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-m-on-surface-variant transition-colors hover:bg-m-surface-low focus-visible:outline-2 focus-visible:outline-m-primary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <div className="relative">
                    <RailMarks position="end" />
                    <input
                      type="text"
                      placeholder="Destination (e.g. Chandigarh)"
                      className={cn(fieldClass, "pl-10")}
                      {...register("destination")}
                    />
                  </div>
                </div>

                {errors.origin && (
                  <p className={errorText}>{errors.origin.message}</p>
                )}
                {errors.destination && (
                  <p className={errorText}>{errors.destination.message}</p>
                )}

                {stops.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setStops((prev) => [...prev, ""])}
                    className="mt-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-m-primary transition-colors hover:bg-m-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Add stop
                  </button>
                )}
              </div>

              {/* Total fare + riders */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-m-on-surface-variant">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Total fare for the trip"
                      className={cn(fieldClass, noSpin, "pl-9")}
                      {...register("totalFare", { valueAsNumber: true })}
                    />
                  </div>
                  {errors.totalFare && (
                    <p className={errorText}>{errors.totalFare.message}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-m-on-surface-variant" />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={`Riders (max ${vehicles[vehicleType].maxSeats})`}
                      className={cn(fieldClass, noSpin, "pl-11")}
                      {...register("availableSeats", { valueAsNumber: true })}
                    />
                  </div>
                  {errors.availableSeats && (
                    <p className={errorText}>{errors.availableSeats.message}</p>
                  )}
                </div>
              </div>

              {perPersonPreview !== null && (
                <p className="px-1 text-sm text-m-on-surface-variant">
                  That is{" "}
                  <span className="font-semibold text-m-primary">
                    {rupees(perPersonPreview)}
                  </span>{" "}
                  per person.
                </p>
              )}

              {/* Bargaining floor (optional) */}
              <div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-m-on-surface-variant">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Lowest price per person you accept (optional)"
                    className={cn(fieldClass, noSpin, "pl-9")}
                    {...register("minPrice", { valueAsNumber: true })}
                  />
                </div>
                <p className="mt-1 px-1 text-xs text-m-on-surface-variant">
                  Riders can offer a lower price. Offers below this amount are
                  turned down. Leave empty to not take offers.
                </p>
                {errors.minPrice && (
                  <p className={errorText}>{errors.minPrice.message}</p>
                )}
              </div>

              {/* Departure date + time slot. PopoverTrigger already renders a <button>,
                  so it is styled directly (no nested <button> = no hydration error). */}
              <div>
                <Controller
                  control={control}
                  name="departureTime"
                  render={({ field }) => {
                    // Applies the chosen HH:MM to a date and returns it
                    const withTime = (base: Date, hhmm: string) => {
                      const [h, m] = hhmm.split(":").map(Number);
                      const d = new Date(base);
                      d.setHours(h || 0, m || 0, 0, 0);
                      return d;
                    };

                    return (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                        <Popover>
                          <PopoverTrigger
                            className={cn(
                              fieldClass,
                              "flex cursor-pointer items-center gap-3 text-left",
                              !field.value && "text-m-on-surface-variant",
                            )}
                          >
                            <CalendarIcon className="h-4 w-4 shrink-0" />
                            <span>
                              {field.value
                                ? format(new Date(field.value), "PPP")
                                : "Pick a departure date"}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={(date) => {
                                if (date) {
                                  field.onChange(
                                    toLocalIso(withTime(date, timeOfDay)),
                                  );
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>

                        <div className="relative sm:w-44">
                          <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-m-on-surface-variant" />
                          <input
                            type="time"
                            aria-label="Departure time"
                            value={timeOfDay}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTimeOfDay(v);
                              if (field.value && v) {
                                field.onChange(
                                  toLocalIso(
                                    withTime(new Date(field.value), v),
                                  ),
                                );
                              }
                            }}
                            className={cn(fieldClass, "pl-11")}
                          />
                        </div>
                      </div>
                    );
                  }}
                />
                {errors.departureTime && (
                  <p className={errorText}>{errors.departureTime.message}</p>
                )}
              </div>

              <button type="submit" disabled={submitting} className={btnFilled}>
                {submitting ? "Publishing..." : "Publish ride"}
              </button>
            </form>
          </section>
        )}

        {/* Rides list */}
        <section className="space-y-5">
          <div className="max-w-full overflow-x-auto">
            {/* M3 segmented button */}
            <div
              role="tablist"
              className="inline-flex overflow-hidden rounded-full border border-m-outline"
            >
              {tabs.map((tab, i) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-m-primary",
                      i > 0 && "border-l border-m-outline",
                      active
                        ? "bg-m-primary-container text-m-on-primary-container"
                        : "text-m-on-surface hover:bg-m-surface-container",
                    )}
                  >
                    {active && <Check className="h-4 w-4" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* "I am going from ... to ..." */}
          <div>
            <p className="mb-2 px-1 text-sm text-m-on-surface-variant">
              Where are you going? Rides passing through your places show up
              too.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "From (e.g. Ludhiana)",
                  value: fromFilter,
                  set: setFromFilter,
                },
                {
                  label: "To (e.g. Chandigarh)",
                  value: toFilter,
                  set: setToFilter,
                },
              ].map((box) => (
                <div key={box.label} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-m-on-surface-variant" />
                  <input
                    type="text"
                    placeholder={box.label}
                    aria-label={box.label}
                    value={box.value}
                    onChange={(e) => box.set(e.target.value)}
                    className="h-12 w-full rounded-full bg-m-surface-container pl-11 pr-4 text-sm text-m-on-surface outline-none placeholder:text-m-on-surface-variant focus:ring-2 focus:ring-m-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-m-card bg-m-surface-container"
                />
              ))}
            </div>
          ) : exactRides.length === 0 && similarRides.length === 0 ? (
            <div className="rounded-m-card border border-dashed border-m-outline-variant px-6 py-12 text-center text-m-on-surface-variant">
              {activeTab === "mine"
                ? "You haven't posted any rides yet."
                : activeTab === "bookings"
                  ? "You haven't booked any seats yet."
                  : "No rides found for that route."}
            </div>
          ) : (
            <>
              {exactRides.length > 0 && (
                <div className="grid gap-5">{exactRides.map(renderCard)}</div>
              )}

              {similarRides.length > 0 && (
                <div className="space-y-4">
                  <div className="px-1">
                    <h3 className="text-lg font-semibold">
                      Going the same way
                    </h3>
                    <p className="text-sm text-m-on-surface-variant">
                      These rides end at {toFilter} but do not pass through{" "}
                      {fromFilter} yet. Open one and ask the driver to add your
                      stop.
                    </p>
                  </div>
                  <div className="grid gap-5">
                    {similarRides.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
