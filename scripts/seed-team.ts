import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const DEFAULT_PASSWORD = "ChangeMeNow!2024";

interface TeamMember {
  name: string;
  email: string;
  role: "partner" | "clinician" | "office_manager";
  isClinician: boolean;
}

const team: TeamMember[] = [
  { name: "Kendra Jones",       email: "kendra@mendingmindstherapy.com",   role: "partner",         isClinician: true },
  { name: "Chelsee Jackson",    email: "chelsee@mendingmindstherapy.com",  role: "partner",         isClinician: true },
  { name: "Ashley Barton",      email: "ashley@mendingmindstherapy.com",   role: "clinician",       isClinician: true },
  { name: "Shandra Powell",     email: "shandra@mendingmindstherapy.com",  role: "clinician",       isClinician: true },
  { name: "Keri Carter",        email: "keri@mendingmindstherapy.com",     role: "clinician",       isClinician: true },
  { name: "Kelsi Russell",      email: "kelsi@mendingmindstherapy.com",    role: "clinician",       isClinician: true },
  { name: "Dennie Asbury",      email: "dennie@mendingmindstherapy.com",   role: "clinician",       isClinician: true },
  { name: "Brooklyn Blanchard", email: "brooklyn@mendingmindstherapy.com", role: "clinician",       isClinician: true },
  { name: "Travis Eide",        email: "travis@mendingmindstherapy.com",   role: "clinician",       isClinician: true },
  { name: "Michelle Smock",     email: "michelle@mendingmindstherapy.com", role: "office_manager",  isClinician: false },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const member of team) {
    const existingUserId = await kv.get<string>(`user:email:${member.email}`);
    if (existingUserId) {
      console.log(`SKIP user: ${member.name} (${member.email}) — already exists`);
      skipped++;
      continue;
    }

    let clinicianId: string | undefined;

    if (member.isClinician) {
      clinicianId = randomUUID();
      const clinician = { id: clinicianId, name: member.name, active: true };
      await kv.set(`clinician:${clinicianId}`, JSON.stringify(clinician));
      await kv.sadd("clinician:index", clinicianId);
      console.log(`  + clinician: ${member.name} (${clinicianId})`);
    }

    const userId = randomUUID();
    const user = {
      id: userId,
      name: member.name,
      email: member.email,
      passwordHash,
      role: member.role,
      clinicianId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`user:${userId}`, JSON.stringify(user));
    await kv.sadd("user:index", userId);
    await kv.set(`user:email:${member.email}`, userId);
    console.log(`  + user: ${member.name} <${member.email}> [${member.role}]`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
