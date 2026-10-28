import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

async function main() {
  const userIds = await kv.smembers("user:index");
  const clinicianIds = await kv.smembers("clinician:index");

  console.log(`Users: ${userIds.length}, Clinicians: ${clinicianIds.length}\n`);

  for (const id of userIds) {
    const raw = await kv.get<string>(`user:${id}`);
    if (!raw) continue;
    const user = typeof raw === "string" ? JSON.parse(raw) : raw;
    const linked = user.clinicianId ? "-> " + user.clinicianId : "(no clinicianId)";
    console.log(`${user.role.padEnd(15)} ${user.name.padEnd(22)} ${user.email.padEnd(40)} ${linked}`);
  }

  console.log("\nClinician records:");
  for (const id of clinicianIds) {
    const raw = await kv.get<string>(`clinician:${id}`);
    if (!raw) { console.log(`  ${id} — MISSING`); continue; }
    const c = typeof raw === "string" ? JSON.parse(raw) : raw;
    console.log(`  ${c.name.padEnd(22)} ${id}`);
  }
}

main().catch(console.error);
