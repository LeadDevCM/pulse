import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const DEFAULT_PASSWORD = "ChangeMeNow!2024";
const GHOST_PASSWORD = "Gh0st!Pulse2024$";

async function main() {
  const userIds = await kv.smembers("user:index");
  console.log(`Found ${userIds.length} users in production\n`);

  let allOk = true;

  for (const id of userIds) {
    const raw = await kv.get<string>(`user:${id}`);
    if (!raw) {
      console.log(`WARN  user:${id} — record missing`);
      allOk = false;
      continue;
    }
    const user = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Check email lookup key exists
    const lookupId = await kv.get<string>(`user:email:${user.email}`);
    const lookupOk = lookupId === id;

    // Check no old-domain key lingers
    const oldEmail = user.email.replace("@mendingmindsutah.com", "@mendingmindstherapy.com");
    const oldKeyExists = user.email.includes("@mendingmindsutah.com")
      ? await kv.get<string>(`user:email:${oldEmail}`)
      : null;

    // Check password
    const expectedPw = user.role === "super_admin" ? GHOST_PASSWORD : DEFAULT_PASSWORD;
    const pwOk = await bcrypt.compare(expectedPw, user.passwordHash);

    const status = lookupOk && pwOk && !oldKeyExists ? "OK   " : "FAIL ";
    if (!lookupOk || !pwOk || oldKeyExists) allOk = false;

    console.log(
      `${status} ${user.name.padEnd(22)} ${user.email.padEnd(38)} role=${user.role.padEnd(15)} ` +
      `lookup=${lookupOk ? "OK" : "MISSING"}  password=${pwOk ? "OK" : "WRONG"}` +
      (oldKeyExists ? `  OLD_KEY_LINGERS` : "")
    );
  }

  console.log(allOk ? "\nAll checks passed." : "\nSome checks FAILED — see above.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
