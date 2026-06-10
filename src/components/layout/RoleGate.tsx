"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/types";

interface RoleGateProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { data: session } = useSession();
  if (!session?.user?.role || !allowedRoles.includes(session.user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
