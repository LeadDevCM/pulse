"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconLayoutDashboard,
  IconMessageCircle,
  IconTrendingUp,
  IconUsers,
  IconCalendarEvent,
  IconSend,
  IconFileText,
  IconShieldCheck,
  IconUserCog,
  IconLogout,
  IconEye,
} from "@tabler/icons-react";
import { useViewAs } from "@/lib/view-context";
import type { Role } from "@/types";

interface SidebarProps {
  userName: string;
}

type ViewableRole = Exclude<Role, "super_admin">;

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: ViewableRole[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <IconLayoutDashboard size={20} />, roles: ["owner", "clinician", "office_manager"] },
  { href: "/dashboard/responses", label: "Responses", icon: <IconMessageCircle size={20} />, roles: ["owner", "clinician"] },
  { href: "/dashboard/trends", label: "Trends", icon: <IconTrendingUp size={20} />, roles: ["owner", "clinician"] },
  { href: "/admin/clients", label: "Clients", icon: <IconUsers size={20} />, roles: ["owner", "office_manager"] },
  { href: "/admin/schedule", label: "Schedule", icon: <IconCalendarEvent size={20} />, roles: ["owner", "office_manager"] },
  { href: "/admin/send", label: "Send Survey", icon: <IconSend size={20} />, roles: ["owner", "office_manager"] },
  { href: "/admin/surveys", label: "Templates", icon: <IconFileText size={20} />, roles: ["owner"] },
  { href: "/admin/users", label: "Users", icon: <IconUserCog size={20} />, roles: ["owner"] },
  { href: "/admin/audit", label: "Audit Log", icon: <IconShieldCheck size={20} />, roles: ["owner"] },
];

const viewLabels: Record<ViewableRole, string> = {
  owner: "Owner",
  clinician: "Clinician",
  office_manager: "Office Manager",
};

export default function Sidebar({ userName }: SidebarProps) {
  const pathname = usePathname();
  const { viewingAs, setViewingAs, isSuperAdmin } = useViewAs();

  const filtered = isSuperAdmin
    ? navItems
    : navItems.filter((item) => item.roles.includes(viewingAs));

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Pulse</h1>
        <p className="text-xs text-text-secondary mt-1">Mending Minds</p>
      </div>

      {isSuperAdmin && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary">
            <IconEye size={14} />
            <span>Viewing as</span>
          </div>
          <div className="flex gap-1 px-2">
            {(Object.keys(viewLabels) as ViewableRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setViewingAs(r)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewingAs === r
                    ? "bg-primary text-white"
                    : "bg-bg-alt text-text-secondary hover:text-text"
                }`}
              >
                {viewLabels[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filtered.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary-light text-primary font-medium"
                  : "text-text-secondary hover:bg-bg-alt hover:text-text"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-sm font-medium text-text truncate">{userName}</div>
        <div className="text-xs text-text-secondary capitalize mb-3">
          {isSuperAdmin ? `${viewLabels[viewingAs]} view` : viewingAs.replace("_", " ")}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-error transition-colors"
        >
          <IconLogout size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
