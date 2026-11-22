import { createContext, useContext } from "react";

export const GlobalContext = createContext(null);

export function useGlobal() {
  const global = useContext(GlobalContext);
  if (!global) {
    throw new Error("useGlobal must be used within a GlobalContext provider");
  }
  return global;
}
