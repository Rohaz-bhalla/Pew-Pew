"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Works like fetch(), but adds the signed-in user's Clerk token.
 * The backend reads that token to know who is calling.
 */
export function useAuthFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    [getToken],
  );
}
