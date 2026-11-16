import { useEffect, useState } from "react";

/** Persisted boolean toggle, shared across the app (works in browser + Tauri). */
export function useLocalToggle(key: string, initial = false) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "true";
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useLocalValue<T extends string>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return (raw as T) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
