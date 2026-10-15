import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage() {
  if (await getAuthUser()) redirect("/search");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">LeadSight</h1>
          <p className="mt-2 text-gray-600">B2B Lead Generation & Digital Audit</p>
        </div>
        <GoogleSignInButton />
        <p className="text-center text-xs text-gray-500">
          By signing in, you grant LeadSight access to create files in your Google Drive.
        </p>
      </div>
    </div>
  );
}
