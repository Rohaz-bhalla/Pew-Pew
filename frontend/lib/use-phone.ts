"use client";

import { useUser } from "@clerk/nextjs";

const VALID = /^\+?[0-9]{10,13}$/;
export const cleanPhone = (v: string) => v.replace(/[\s-]/g, "");

export function usePhone() {
  const { user } = useUser();
  const phone = (user?.unsafeMetadata?.phone as string | undefined) ?? "";

  // Store the number on the Clerk profile (keeps other metadata, e.g. the role)
  const savePhone = async (value: string) => {
    const clean = cleanPhone(value);
    if (!user || !VALID.test(clean) || clean === phone) return;
    await user.update({
      unsafeMetadata: { ...user.unsafeMetadata, phone: clean },
    });
  };

  // Returns the saved number, or asks once and saves it. null = cancelled/invalid.
  const ensurePhone = async (): Promise<string | null> => {
    if (VALID.test(phone)) return phone;
    const entered = window.prompt(
      "Your phone number (shared only with the driver or your passengers):",
    );
    const clean = cleanPhone(entered ?? "");
    if (!VALID.test(clean)) return null;
    await savePhone(clean);
    return clean;
  };

  return { phone, savePhone, ensurePhone };
}