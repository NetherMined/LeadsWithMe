"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApiUsage } from "@/components/account/api-usage";
import { Settings } from "@/components/account/settings";

export default function AccountPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("settings");

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex items-center justify-center rounded-full text-[16px] font-bold shrink-0"
          style={{
            width: 48,
            height: 48,
            background: "var(--amber-dim)",
            border: "2px solid var(--amber)",
            color: "var(--amber)",
            fontFamily: "var(--font-display)",
          }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[16px] font-bold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            My Account
          </p>
          <p className="text-[12px] text-text-muted font-mono mt-0.5">
            {user?.email ?? "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 4,
            marginBottom: 24,
            gap: 2,
          }}
        >
          {[
            { value: "settings", label: "Settings" },
            { value: "api-usage", label: "API Usage" },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              onClick={() => setActiveTab(tab.value)}
              data-state={activeTab === tab.value ? "active" : "inactive"}
              style={{
                fontSize: 13,
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: activeTab === tab.value ? "var(--accent)" : "var(--text-muted)",
                background: activeTab === tab.value ? "var(--bg-surface)" : "transparent",
                border: activeTab === tab.value ? "1px solid var(--border)" : "1px solid transparent",
                borderRadius: 6,
                padding: "6px 16px",
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeTab === "settings" && (
          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        )}
        {activeTab === "api-usage" && (
          <TabsContent value="api-usage">
            <ApiUsage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
