"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import type { AppUser } from "@/lib/auth/server";

interface AuthContextValue {
  user: AppUser | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  signOut: async () => {},
});

/**
 * The dashboard layout resolves the user on the server and passes it in, so
 * there is no client-side loading state or auth flicker.
 */
export function AuthProvider({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
