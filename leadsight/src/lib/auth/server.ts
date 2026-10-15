import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export const isAuthDisabled = () => process.env.DISABLE_AUTH === "true";

const DEV_USER: AppUser = {
  id: process.env.DEV_USER_ID ?? "14e6c02a-b318-4c6f-ba2f-4d4323718ea4",
  email: "dev@localhost",
  name: "Dev User",
};

/**
 * Returns the signed-in user, or the seeded dev user when DISABLE_AUTH=true.
 * Use this in API routes and server components.
 */
export async function getAuthUser(): Promise<AppUser | null> {
  if (isAuthDisabled()) return DEV_USER;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name, image } = session.user;
  return { id, email, name, image };
}
