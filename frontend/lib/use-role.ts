"use client";

import { useUser } from "@clerk/nextjs";

export type Role = "rider" | "driver";

/**
 * Rider / driver mode, saved on the user's Clerk profile.
 * This only changes which controls the UI shows.
 * Real protection is on the backend (you can only delete your own rides, etc.).
 */
export function useRole() {
  const { user } = useUser();

  const stored = user?.unsafeMetadata?.role;
  const role: Role | null =
    stored === "driver" || stored === "rider" ? stored : null;

  const setRole = async (newRole: Role) => {
    await user?.update({
      unsafeMetadata: { ...user.unsafeMetadata, role: newRole },
    });
  };

  return { role, setRole };
}
