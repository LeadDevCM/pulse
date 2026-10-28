import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import "dotenv/config";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

async function main() {
  const email = "michelle@mendingmindstherapy.com";

  const existing = await kv.get<string>(`user:email:${email}`);
  if (existing) {
    console.log("User already exists with id:", existing);
    process.exit(1);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const password = "ChangeMeNow!2024";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    id,
    name: "Michelle",
    email,
    passwordHash,
    role: "office_manager",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`user:${id}`, JSON.stringify(user));
  await kv.sadd("user:index", id);
  await kv.set(`user:email:${email}`, id);

  console.log("Created user:", { id, name: user.name, email, role: user.role });
  console.log("Password:", password);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
