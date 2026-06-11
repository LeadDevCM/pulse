import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { User } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["owner"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`user:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updates = await request.json();

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.clinicianId !== undefined) user.clinicianId = updates.clinicianId;
  if (updates.active !== undefined) user.active = updates.active;
  if (updates.password) {
    if (updates.password.length < 12) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }
    user.passwordHash = await bcrypt.hash(updates.password, 12);
  }
  user.updatedAt = new Date().toISOString();

  await kv.set(`user:${id}`, JSON.stringify(user));

  await logAudit({
    action: "user_modified",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "user",
    resourceId: id,
  });

  const { passwordHash, ...safe } = user;
  return NextResponse.json({ success: true, user: safe });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["owner"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`user:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
  user.active = false;
  user.updatedAt = new Date().toISOString();

  await kv.set(`user:${id}`, JSON.stringify(user));
  await kv.srem("user:index", id);
  await kv.del(`user:email:${user.email}`);

  await logAudit({
    action: "user_modified",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "user",
    resourceId: id,
  });

  return NextResponse.json({ success: true });
}
