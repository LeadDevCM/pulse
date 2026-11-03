import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const routeRoles: [string, string[]][] = [
  ["/dashboard/compare", ["partner", "office_manager"]],
  ["/dashboard/reports", ["partner", "office_manager"]],
  ["/dashboard/responses", ["partner", "clinician", "office_manager"]],
  ["/dashboard/trends", ["partner", "clinician", "office_manager"]],
  ["/admin/retention", ["partner", "office_manager"]],
  ["/admin/audit", ["partner"]],
  ["/admin/clients", ["partner", "office_manager"]],
  ["/admin/schedule", ["partner", "office_manager"]],
  ["/admin/send", ["partner", "office_manager"]],
  ["/admin/surveys", ["partner"]],
  ["/admin/users", ["partner"]],
  ["/dashboard", ["partner", "clinician", "office_manager"]],
];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string;
  if (role === "super_admin") return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  for (const [route, allowedRoles] of routeRoles) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (!allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
