"use client";

import { useCallback, useSyncExternalStore } from "react";

// The city a user picked in the header. Saved in the browser (localStorage),
// so it is still there next time. Empty text means "All cities".
const KEY = "pewpew-city";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // other tabs
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

// On the server there is no browser storage
const getServerSnapshot = () => "";

export function useCity() {
  const city = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCity = useCallback((value: string) => {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked: ignore
    }
    listeners.forEach((callback) => callback()); // update every component using it
  }, []);

  return { city, setCity };
}
