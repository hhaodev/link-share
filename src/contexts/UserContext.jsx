import { createContext, useContext } from "react";

export const UserContext = createContext(null);

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error("useUser must be used within a UserContext provider");
  }
  return context.user;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error(
      "useUserContext must be used within a UserContext provider",
    );
  }
  return context;
}
