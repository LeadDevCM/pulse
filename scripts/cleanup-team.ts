import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEEP_EMAILS = new Set([
  "kendra@mendingmindsutah.com",
  "chelsee@mendingmindsutah.com",
  "ashley@mendingmindsutah.com",
  "shandra@mendingmindsutah.com",
  "keri@mendingmindsutah.com",
  "kelsi@mendingmindsutah.com",
  "dennie@mendingmindsutah.com",
  "brooklyn@mendingmindsutah.com",
  "travis@mendingmindsutah.com",
  "michelle@mendingmindsutah.com",
  "ghost@cedarcitywebdesign.com",
]);

const KEEP_CLINICIAN_NAMES = new Set([
  "Kendra Jones",
  "Chelsee Jackson",
  "Ashley Barton",
  "Shandra Powell",
  "Keri Carter",
  "Kelsi Russell",
  "Dennie Asbury",
  "Brooklyn Blanchard",
  "Travis Eide",
]);

async function main() {
  // --- Clean up users ---
  const userIds = await kv.smembers("user:index");
  const seenEmails = new Set<string>();
  let usersRemoved = 0;

  for (const id of userIds) {
    const raw = await kv.get<string>(`user:${id}`);
    if (!raw) continue;
    const user = typeof raw === "string" ? JSON.parse(raw) : raw;

    const isDuplicate = seenEmails.has(user.email);
    const isKeep = KEEP_EMAILS.has(user.email);

    if (!isKeep || isDuplicate) {
      await kv.del(`user:${id}`);
      await kv.srem("user:index", id);
      if (!isDuplicate) await kv.del(`user:email:${user.email}`);
      console.log(`REMOVE user: ${user.name} <${user.email}> [${user.role}]${isDuplicate ? " (duplicate)" : ""}`);
      usersRemoved++;
    } else {
      seenEmails.add(user.email);
      console.log(`KEEP   user: ${user.name} <${user.email}> [${user.role}]`);
    }
  }

  // --- Clean up clinicians ---
  const clinicianIds = await kv.smembers("clinician:index");
  const seenClinicianNames = new Set<string>();
  let cliniciansRemoved = 0;

  for (const id of clinicianIds) {
    const raw = await kv.get<string>(`clinician:${id}`);
    if (!raw) continue;
    const c = typeof raw === "string" ? JSON.parse(raw) : raw;

    const isDuplicate = seenClinicianNames.has(c.name);
    const isKeep = KEEP_CLINICIAN_NAMES.has(c.name);

    if (!isKeep || isDuplicate) {
      await kv.del(`clinician:${id}`);
      await kv.srem("clinician:index", id);
      console.log(`REMOVE clinician: ${c.name} (${id})${isDuplicate ? " (duplicate)" : ""}`);
      cliniciansRemoved++;
    } else {
      seenClinicianNames.add(c.name);
      console.log(`KEEP   clinician: ${c.name} (${id})`);
    }
  }

  console.log(`\nDone: removed ${usersRemoved} users, ${cliniciansRemoved} clinicians`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
