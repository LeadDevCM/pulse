"use client";

import { createContext, useContext, useState } from "react";
import type { Role } from "@/types";

type ViewableRole = Exclude<Role, "super_admin">;

interface ViewContextType {
  viewingAs: ViewableRole;
  setViewingAs: (role: ViewableRole) => void;
  isSuperAdmin: boolean;
}

const ViewContext = createContext<ViewContextType>({
  viewingAs: "owner",
  setViewingAs: () => {},
  isSuperAdmin: false,
});

export function useViewAs() {
  return useContext(ViewContext);
}

export function ViewProvider({
  actualRole,
  children,
}: {
  actualRole: Role;
  children: React.ReactNode;
}) {
  const isSuperAdmin = actualRole === "super_admin";
  const [viewingAs, setViewingAs] = useState<ViewableRole>(
    isSuperAdmin ? "owner" : (actualRole as ViewableRole)
  );

  return (
    <ViewContext.Provider value={{ viewingAs, setViewingAs, isSuperAdmin }}>
      {children}
    </ViewContext.Provider>
  );
}
