import { useState, useEffect, useCallback } from "react";

export const useLocalState = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save localStorage [${key}]:`, error);
    }
  }, [key, value]);

  const updateValue = useCallback((newValue) => {
    setValue((prev) =>
      typeof newValue === "function" ? newValue(prev) : newValue,
    );
  }, []);

  // Sync between tabs
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== key) return;

      try {
        setValue(
          event.newValue !== null ? JSON.parse(event.newValue) : defaultValue,
        );
      } catch (error) {
        console.error(`Failed to sync localStorage [${key}]:`, error);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, defaultValue]);

  return [value, updateValue];
};
