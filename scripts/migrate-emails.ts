import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const OLD_DOMAIN = "@mendingmindstherapy.com";
const NEW_DOMAIN = "@mendingmindsutah.com";

async function main() {
  const userIds = await kv.smembers("user:index");
  let migrated = 0;
  let skipped = 0;

  for (const id of userIds) {
    const raw = await kv.get<string>(`user:${id}`);
    if (!raw) continue;
    const user = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!user.email.endsWith(OLD_DOMAIN)) {
      console.log(`SKIP  ${user.name} <${user.email}> — not on old domain`);
      skipped++;
      continue;
    }

    const newEmail = user.email.replace(OLD_DOMAIN, NEW_DOMAIN);

    // Remove old email lookup key
    await kv.del(`user:email:${user.email}`);

    // Update user record
    user.email = newEmail;
    user.updatedAt = new Date().toISOString();
    await kv.set(`user:${id}`, JSON.stringify(user));

    // Create new email lookup key
    await kv.set(`user:email:${newEmail}`, id);

    console.log(`OK    ${user.name}: ${user.email.replace(NEW_DOMAIN, OLD_DOMAIN)} → ${newEmail}`);
    migrated++;
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
