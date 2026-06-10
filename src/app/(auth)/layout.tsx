"use client";

import { useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { ViewProvider } from "@/lib/view-context";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import type { Role } from "@/types";

function AuthLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!session) return null;

  return (
    <ViewProvider actualRole={session.user.role as Role}>
      <div className="min-h-screen flex bg-bg-alt">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          <Sidebar userName={session.user.name || "User"} />
        </div>

        <div className="flex-1 flex flex-col min-h-screen">
          <Header
            title="Pulse"
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </ViewProvider>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AuthLayoutInner>{children}</AuthLayoutInner>
      </ToastProvider>
    </SessionProvider>
  );
}
