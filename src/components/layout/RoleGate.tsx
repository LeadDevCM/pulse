"use client";

import { useViewAs } from "@/lib/view-context";
import type { Role } from "@/types";

interface RoleGateProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { viewingAs, isSuperAdmin } = useViewAs();

  if (isSuperAdmin) {
    if (allowedRoles.includes(viewingAs)) return <>{children}</>;
    return <>{fallback}</>;
  }

  if (!allowedRoles.includes(viewingAs)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
