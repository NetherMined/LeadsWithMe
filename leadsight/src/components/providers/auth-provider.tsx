"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const DISABLE_AUTH = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

const MOCK_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "14e6c02a-b318-4c6f-ba2f-4d4323718ea4",
  email: "dev@localhost",
  user_metadata: { full_name: "Dev User" },
} as unknown as User;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DISABLE_AUTH ? MOCK_USER : null);
  const [loading, setLoading] = useState(!DISABLE_AUTH);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    if (DISABLE_AUTH) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (DISABLE_AUTH) return;
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router, pathname]);

  async function signOut() {
    if (DISABLE_AUTH) {
      router.push("/login");
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-surface)",
        }}
      >
        <div
          style={{
            height: "2rem",
            width: "2rem",
            animation: "spin 1s linear infinite",
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.2)",
            borderTopColor: "var(--accent-blue)",
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
