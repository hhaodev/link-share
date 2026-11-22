import { useState, useEffect } from "react";

export function useQueryState(
  key,
  defaultValue = null,
  { replace = false } = {},
) {
  const [value, setValue] = useState(
    () => new URLSearchParams(window.location.search).get(key) ?? defaultValue,
  );

  const set = (newValue, opts = {}) => {
    const params = new URLSearchParams(window.location.search);
    if (newValue == null || newValue === "") {
      params.delete(key);
    } else {
      params.set(key, newValue);
    }
    const search = params.toString();
    const url = search ? `?${search}` : window.location.pathname;
    if (opts.replace ?? replace) {
      window.history.replaceState({}, "", url);
    } else {
      window.history.pushState({}, "", url);
    }
    setValue(newValue);
  };

  useEffect(() => {
    const onPop = () => {
      setValue(
        new URLSearchParams(window.location.search).get(key) ?? defaultValue,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [key]);

  return [value, set];
}
