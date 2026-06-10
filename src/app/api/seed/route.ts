import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available" }, { status: 403 });
  }

  const result = await seedDatabase();
  return NextResponse.json({ success: true, seeded: result });
}
