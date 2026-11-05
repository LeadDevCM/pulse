import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getAuditLogs } from "@/lib/audit";

export async function GET(request: Request) {
  const { error } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDateParam = url.searchParams.get("endDate");
  const endDate = endDateParam
    ? new Date(new Date(endDateParam).getTime() + 24 * 60 * 60 * 1000 - 1)
    : new Date();
  const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 500);
  const page = Number(url.searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  try {
    const { entries: logs, total } = await getAuditLogs(startDate, endDate, limit, offset);

    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("userId");

    let filtered = logs;
    if (action) filtered = filtered.filter((l) => l.action === action);
    if (userId) filtered = filtered.filter((l) => l.userId === userId);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ logs: filtered, page, limit, total, totalPages });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "audit_query_failed", detail, logs: [], total: 0, totalPages: 1 }, { status: 500 });
  }
}
