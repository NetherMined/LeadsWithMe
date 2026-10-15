import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getAuthUser } from "@/lib/auth/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <div className="flex h-screen" style={{ background: "var(--bg-deep)" }}>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-auto" style={{ background: "var(--bg-deep)" }}>
            <div className="mx-auto max-w-6xl px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
