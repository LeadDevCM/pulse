import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { User } from "@/types";

export async function GET() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const ids = await kv.smembers("user:index");
  const users: Omit<User, "passwordHash">[] = [];

  for (const id of ids) {
    const raw = await kv.get<string>(`user:${id}`);
    if (!raw) continue;
    const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
    const { passwordHash, ...safe } = user;
    users.push(safe);
  }

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { error, session } = await requireRole(["owner"]);
  if (error) return error;

  const { name, email, password, role, clinicianId } = await request.json();
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (password.length < 12) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const existingId = await kv.get<string>(`user:email:${email}`);
  if (existingId) {
    return NextResponse.json({ error: "email_exists" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const user: User = {
    id,
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role,
    clinicianId,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`user:${id}`, JSON.stringify(user));
  await kv.sadd("user:index", id);
  await kv.set(`user:email:${email}`, id);

  await logAudit({
    action: "user_created",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "user",
    resourceId: id,
    metadata: { email, role },
  });

  const { passwordHash, ...safe } = user;
  return NextResponse.json({ success: true, user: safe });
}
