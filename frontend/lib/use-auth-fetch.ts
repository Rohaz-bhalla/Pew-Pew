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

/**
 * Turns a failed response into a readable message for the user.
 * An empty 401 from the backend means it rejected the login token.
 */
export function failMessage(status: number, text: string, fallback: string) {
  if (text) return text;
  if (status === 401) {
    return "The backend did not accept your login (401). Try signing out and in again.";
  }
  return `${fallback} (error ${status}).`;
}
