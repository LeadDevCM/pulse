import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getAuditLogs } from "@/lib/audit";

export async function GET(request: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = url.searchParams.get("endDate")
    ? new Date(url.searchParams.get("endDate")!)
    : new Date();
  const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 500);
  const page = Number(url.searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  const logs = await getAuditLogs(startDate, endDate, limit, offset);

  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");

  let filtered = logs;
  if (action) filtered = filtered.filter((l) => l.action === action);
  if (userId) filtered = filtered.filter((l) => l.userId === userId);

  return NextResponse.json({ logs: filtered, page, limit });
}
