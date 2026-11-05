/**
 * One-shot migration script: imports missing active clients from Google Drive
 * retention sheets and backfills retention data on existing matched clients.
 *
 * Usage: node scripts/import-retention-data.mjs [--dry-run]
 *
 * Requires: .env.prod or env vars with ENCRYPTION_KEY, KV_REST_API_URL, KV_REST_API_TOKEN
 */
import crypto from "crypto";
import { readFileSync } from "fs";

// Load .env.prod manually (no dotenv dependency)
const envText = readFileSync(new URL("../.env.prod", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ENC_KEY = Buffer.from(process.env.ENCRYPTION_KEY.replace(/\\n$/, ""), "hex");
const DRY_RUN = process.argv.includes("--dry-run");

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedStr) {
  const [ivHex, authTagHex, ciphertext] = encryptedStr.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function phoneIndexKey(phone) {
  const hmac = crypto.createHmac("sha256", ENC_KEY);
  hmac.update(`phone:${phone}`);
  return `client:phone:${hmac.digest("hex")}`;
}

async function kvExec(cmd) {
  const res = await fetch(`${KV_URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/GET/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function kvSet(key, value) {
  if (DRY_RUN) return;
  const res = await fetch(`${KV_URL}/SET/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  return res.json();
}

async function kvSadd(key, member) {
  if (DRY_RUN) return;
  const res = await fetch(`${KV_URL}/SADD/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  return res.json();
}

async function kvSmembers(key) {
  const res = await fetch(`${KV_URL}/SMEMBERS/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result || [];
}

async function kvPipeline(commands) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  return res.json();
}

// ---- Clinician name map ----
async function buildClinicianMap() {
  const clinIds = await kvSmembers("clinician:index");
  const pipeline = clinIds.map((id) => ["GET", `clinician:${id}`]);
  const results = await kvPipeline(pipeline);
  const map = {};
  for (const r of results) {
    if (!r.result) continue;
    const c = typeof r.result === "string" ? JSON.parse(r.result) : r.result;
    map[c.name.toLowerCase()] = c.id;
    // Also map last name only
    const parts = c.name.split(" ");
    if (parts.length > 1) map[parts[parts.length - 1].toLowerCase()] = c.id;
  }
  return map;
}

// ---- Load existing clients ----
async function loadExistingClients() {
  const clientIds = await kvSmembers("client:index");
  const pipeline = clientIds.map((id) => ["GET", `client:${id}`]);
  const results = await kvPipeline(pipeline);
  const clients = [];
  for (let i = 0; i < results.length; i++) {
    const raw = results[i].result;
    if (!raw) continue;
    const client = typeof raw === "string" ? JSON.parse(raw) : raw;
    let firstName = "", lastName = "";
    try { firstName = decrypt(client.firstName); } catch { firstName = ""; }
    try { lastName = decrypt(client.lastName); } catch { lastName = ""; }
    clients.push({ ...client, _firstName: firstName, _lastName: lastName, _id: clientIds[i] });
  }
  return clients;
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(driveName, dbClients) {
  const driveNorm = normalize(driveName);
  const driveParts = driveNorm.split(" ").filter((w) => w.length > 1);
  for (const db of dbClients) {
    const dbNorm = normalize(`${db._firstName} ${db._lastName}`);
    const dbParts = dbNorm.split(" ").filter((w) => w.length > 1);
    const overlap = driveParts.filter((p) => dbParts.includes(p));
    if (overlap.length >= 2) return db;
  }
  return null;
}

function mapFrequency(raw) {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (lower.includes("weekly") && !lower.includes("other") && !lower.includes("every")) return "weekly";
  if (lower.includes("every other") || lower.includes("every 2") || lower.includes("biweekly")) return "every_other_week";
  if (lower.includes("monthly")) return "monthly";
  if (lower.includes("as needed") || lower.includes("as_needed")) return "as_needed";
  if (lower.includes("never")) return "never_seen";
  if (lower.includes("inactive")) return undefined;
  if (lower.includes("twice")) return "weekly"; // close enough
  return undefined;
}

function mapStatus(raw, isTerminated) {
  if (!raw) return "active";
  const lower = raw.toLowerCase();
  if (isTerminated || lower === "yes" || lower === "true") return "terminated";
  if (lower === "inactive" || lower === "no") return undefined; // ambiguous
  return undefined;
}

function parseDate(raw) {
  if (!raw || raw === "N/A" || raw === "-") return undefined;
  const cleaned = raw.replace(/\s+/g, "").trim();
  // Handle M/D/YYYY or M/D/YY
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return undefined;
  let [, m, d, y] = match;
  if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  const result = `${y}-${mm}-${dd}`;
  // Sanity check
  if (parseInt(y) < 2000 || parseInt(y) > 2030) return undefined;
  return result;
}

// ---- Active clients from Drive retention sheets ----
// Only active/scheduled clients (the ones that matter for ongoing surveys)
const DRIVE_ACTIVE_CLIENTS = [
  // K. Russell
  { name: "Allison Adams", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "2/2/2026", lastApptDate: "11/2/2026", status: "active" },
  { name: "Griffin Alexander", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "", lastApptDate: "11/3/2026", status: "active" },
  { name: "Ross Cape", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "10/3/2025", lastApptDate: "9/2/2026", status: "active" },
  { name: "Camryn Carter", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "9/1/2025", lastApptDate: "11/2/2026", status: "active" },
  { name: "Amy Michelle Conriquez", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "8/21/2024", lastApptDate: "10/30/2026", status: "active" },
  { name: "Diana Davis", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "4/27/2026", lastApptDate: "11/3/2026", status: "active" },
  { name: "Erica Marie Laws", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "6/12/2025", lastApptDate: "11/4/2026", status: "active" },
  { name: "Nik Lukens", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "3/31/2026", lastApptDate: "10/16/2026", status: "active" },
  { name: "Marissa Maciel", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "12/16/2024", lastApptDate: "11/4/2026", status: "active" },
  { name: "Miranda Mayes", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "2/15/2024", lastApptDate: "10/27/2026", status: "active" },
  { name: "Alexa Pautrat", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "9/11/2025", lastApptDate: "10/27/2026", status: "active" },
  { name: "Venessa Stratton", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "9/15/2025", lastApptDate: "10/29/2026", status: "active" },
  { name: "Amy Bentley", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "6/26/2026", lastApptDate: "11/4/2026", status: "active" },
  { name: "Nathan Billings", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "9/9/2026", lastApptDate: "11/3/2026", status: "active" },
  { name: "Zachary Bracamonte", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "5/17/2024", lastApptDate: "11/4/2026", status: "active" },
  { name: "McKay Cook", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "4/15/2026", lastApptDate: "10/29/2026", status: "active" },
  { name: "Mackenzie Morrison", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "8/19/2026", lastApptDate: "10/20/2026", status: "active" },
  { name: "Antione Pautrat", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "7/9/2026", lastApptDate: "10/28/2026", status: "active" },
  { name: "Connor Smock", clinician: "Kelsi Russell", frequency: "Weekly", startDate: "", lastApptDate: "11/3/2026", status: "active" },
  { name: "Karly Elaine Jense", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "8/12/2025", lastApptDate: "10/21/2026", status: "active" },
  { name: "Harley Jane Jenkins", clinician: "Kelsi Russell", frequency: "Every other week", startDate: "10/16/2025", lastApptDate: "6/29/2026", status: "active" },

  // A. Barton
  { name: "Hanson Corry", clinician: "Ashley Barton", frequency: "Weekly", startDate: "11/11/2024", lastApptDate: "11/2/2026", status: "active" },
  { name: "Dennis M. Davis", clinician: "Ashley Barton", frequency: "Every other week", startDate: "4/24/2026", lastApptDate: "10/15/2026", status: "active" },
  { name: "Levi Hansen", clinician: "Ashley Barton", frequency: "Weekly", startDate: "8/2/2024", lastApptDate: "10/26/2026", status: "active" },
  { name: "Kasen Jones", clinician: "Ashley Barton", frequency: "Every other week", startDate: "8/23/2024", lastApptDate: "9/11/2026", status: "active" },
  { name: "McKya Mitchell", clinician: "Ashley Barton", frequency: "Every other week", startDate: "5/9/2025", lastApptDate: "10/28/2026", status: "active" },
  { name: "McKray Mitchell", clinician: "Ashley Barton", frequency: "Every other week", startDate: "11/24/2025", lastApptDate: "10/30/2026", status: "active" },
  { name: "Sophia Mock", clinician: "Ashley Barton", frequency: "Every other week", startDate: "4/20/2026", lastApptDate: "11/2/2026", status: "active" },
  { name: "Megan Randi Morales", clinician: "Ashley Barton", frequency: "Monthly", startDate: "1/26/2024", lastApptDate: "10/28/2026", status: "active" },
  { name: "Romi Rodriguez", clinician: "Ashley Barton", frequency: "Every other week", startDate: "2/5/2026", lastApptDate: "10/9/2026", status: "active" },
  { name: "Indy Young", clinician: "Ashley Barton", frequency: "Every other week", startDate: "5/30/2025", lastApptDate: "10/30/2026", status: "active" },
  { name: "Brewer Anderson", clinician: "Ashley Barton", frequency: "Weekly", startDate: "8/7/2026", lastApptDate: "10/30/2026", status: "active" },
  { name: "Aria Carbello", clinician: "Ashley Barton", frequency: "Weekly", startDate: "3/29/2026", lastApptDate: "11/2/2026", status: "active" },
  { name: "Evie Cox", clinician: "Ashley Barton", frequency: "Every other week", startDate: "7/21/2026", lastApptDate: "9/4/2026", status: "active" },
  { name: "Jared Marthaler", clinician: "Ashley Barton", frequency: "Every other week", startDate: "7/23/2026", lastApptDate: "10/27/2026", status: "active" },
  { name: "Robbie Edie", clinician: "Ashley Barton", frequency: "Every other week", startDate: "10/29/2026", lastApptDate: "10/29/2026", status: "active" },
  { name: "Melanie Jasnikowski", clinician: "Ashley Barton", frequency: "Weekly", startDate: "7/17/2026", lastApptDate: "10/30/2026", status: "active" },
  { name: "Mila Shull", clinician: "Ashley Barton", frequency: "Weekly", startDate: "10/19/2026", lastApptDate: "10/19/2026", status: "active" },
  { name: "Audrey Uresk", clinician: "Ashley Barton", frequency: "Weekly", startDate: "10/1/2026", lastApptDate: "10/29/2026", status: "active" },
  { name: "Scott Dee Anderson", clinician: "Ashley Barton", frequency: "Weekly", startDate: "10/17/2025", lastApptDate: "7/30/2026", status: "active" },
  { name: "Chloe Bracamonte", clinician: "Ashley Barton", frequency: "Every other week", startDate: "5/10/2024", lastApptDate: "", status: "active" },

  // D. Asbury
  { name: "Kashton Anderson", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/24/2026", lastApptDate: "10/7/2026", status: "active" },
  { name: "Becky Bowden", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "4/10/2026", lastApptDate: "10/14/2026", status: "active" },
  { name: "Lilli Burke", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/10/2026", lastApptDate: "10/12/2026", status: "active" },
  { name: "Shaylan Fingers", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "9/13/2023", lastApptDate: "10/14/2026", status: "active" },
  { name: "Rodney Frandsen", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "9/3/2025", lastApptDate: "10/13/2026", status: "active" },
  { name: "Amber Galetka", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "3/6/2026", lastApptDate: "10/9/2026", status: "active" },
  { name: "Lyndsey Healey", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/24/2026", lastApptDate: "10/6/2026", status: "active" },
  { name: "Kenzie Jones", clinician: "Dennie Asbury", frequency: "Monthly", startDate: "5/8/2026", lastApptDate: "10/8/2026", status: "active" },
  { name: "Lou Keroack", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/25/2025", lastApptDate: "10/13/2026", status: "active" },
  { name: "Kaydee Kreci", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "5/15/2026", lastApptDate: "10/9/2026", status: "active" },
  { name: "Ryn Maxwell", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/10/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "Ashley Powers", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "1/20/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "Adela Terry", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "4/1/2026", lastApptDate: "10/1/2026", status: "active" },
  { name: "Maddox Tuttle", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "2/4/2026", lastApptDate: "10/8/2026", status: "active" },
  { name: "LaTosha Anderson", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "8/12/2026", lastApptDate: "10/14/2026", status: "active" },
  { name: "Rebeka Dimick", clinician: "Dennie Asbury", frequency: "Every other week", startDate: "6/24/2026", lastApptDate: "10/7/2026", status: "active" },
  { name: "Macie Dolan", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "6/11/2026", lastApptDate: "10/9/2026", status: "active" },
  { name: "Emile Gold", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "8/19/2026", lastApptDate: "10/7/2026", status: "active" },
  { name: "Amanda Guevara", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/18/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "Kevin Halstead", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/22/2026", lastApptDate: "10/8/2026", status: "active" },
  { name: "Kaitlyn Hammon", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/3/2026", lastApptDate: "9/25/2026", status: "active" },
  { name: "Tommy Lamb", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "9/1/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "Wren Olivia Leavitt", clinician: "Dennie Asbury", frequency: "Every other week", startDate: "5/21/2026", lastApptDate: "8/17/2026", status: "active" },
  { name: "Kolter Mason", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/7/2026", lastApptDate: "9/28/2026", status: "active" },
  { name: "Lavri Mock", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/15/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "Alex Moore", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/10/2026", lastApptDate: "10/15/2026", status: "active" },
  { name: "Kassidy Nicholes", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "5/18/2026", lastApptDate: "10/9/2026", status: "active" },
  { name: "Bryce Pleasant", clinician: "Dennie Asbury", frequency: "Every other week", startDate: "5/19/2026", lastApptDate: "9/15/2026", status: "active" },
  { name: "Jessica Robinson", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "8/11/2026", lastApptDate: "10/13/2026", status: "active" },
  { name: "RJ Strayer", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "7/21/2026", lastApptDate: "10/15/2026", status: "active" },
  { name: "Kaitllyn Tew", clinician: "Dennie Asbury", frequency: "Every other week", startDate: "", lastApptDate: "10/13/2026", status: "active" },
  { name: "Keralee Wells", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "5/5/2026", lastApptDate: "10/12/2026", status: "active" },
  { name: "Kason Young", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "3/6/2026", lastApptDate: "9/1/2026", status: "active" },
  { name: "Madison Nunly", clinician: "Dennie Asbury", frequency: "Weekly", startDate: "10/8/2026", lastApptDate: "10/8/2026", status: "active" },

  // C. Jackson
  { name: "Tasha Baxter", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "1/23/2025", lastApptDate: "10/30/2026", status: "active" },
  { name: "Paige Resendiz", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "3/6/2025", lastApptDate: "10/13/2026", status: "active" },
  { name: "Bryanna Rose Carpenter", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "9/9/2025", lastApptDate: "10/21/2026", status: "active" },
  { name: "Camila Causey", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "8/25/2025", lastApptDate: "10/21/2026", status: "active" },
  { name: "Luna Corry", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "11/14/2024", lastApptDate: "10/20/2026", status: "active" },
  { name: "Ashlyn Emily Cowdell", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "4/22/2025", lastApptDate: "9/29/2026", status: "active" },
  { name: "Ashley Lynn Derrick", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "1/1/2025", lastApptDate: "10/23/2026", status: "active" },
  { name: "Gracie Luana Feltner", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "2/10/2025", lastApptDate: "10/29/2026", status: "active" },
  { name: "Lili Gutierrez", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "1/31/2025", lastApptDate: "10/28/2026", status: "active" },
  { name: "James C Henselen", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "2/13/2025", lastApptDate: "10/28/2026", status: "active" },
  { name: "Taylor Henselen", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "7/29/2025", lastApptDate: "10/21/2026", status: "active" },
  { name: "Ashlyn Paige Johnson", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "7/2/2025", lastApptDate: "10/27/2026", status: "active" },
  { name: "Adam Luke", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "2/4/2025", lastApptDate: "10/27/2026", status: "active" },
  { name: "Bill Maxwell", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "9/30/2025", lastApptDate: "10/27/2026", status: "active" },
  { name: "Holly Mayes", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "12/13/2023", lastApptDate: "10/29/2026", status: "active" },
  { name: "Katy Moss", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "9/19/2023", lastApptDate: "10/22/2026", status: "active" },
  { name: "Taylor Syrett", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "1/8/2025", lastApptDate: "10/15/2026", status: "active" },
  { name: "Averie Winslow", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "8/18/2025", lastApptDate: "10/28/2026", status: "active" },
  { name: "Aaron James Yardley", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "2/4/2025", lastApptDate: "10/20/2026", status: "active" },
  { name: "Tony Zufelt", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "2/25/2025", lastApptDate: "10/28/2026", status: "active" },
  { name: "Angel Sisneros", clinician: "Chelsee Jackson", frequency: "Every other week", startDate: "4/28/2026", lastApptDate: "10/29/2026", status: "active" },
  { name: "Sarah Hobson", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "5/20/2026", lastApptDate: "10/27/2026", status: "active" },
  { name: "Ean Jacomb", clinician: "Chelsee Jackson", frequency: "Monthly", startDate: "7/16/2026", lastApptDate: "10/23/2026", status: "active" },
  { name: "Nichole Jacomb", clinician: "Chelsee Jackson", frequency: "Monthly", startDate: "6/25/2026", lastApptDate: "10/23/2026", status: "active" },
  { name: "Melanie Janokowski", clinician: "Chelsee Jackson", frequency: "Monthly", startDate: "7/14/2026", lastApptDate: "10/8/2026", status: "active" },
  { name: "RJ Strayer", clinician: "Chelsee Jackson", frequency: "Monthly", startDate: "7/14/2026", lastApptDate: "10/8/2026", status: "active" },
  { name: "Chloe Johnson", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "3/31/2026", lastApptDate: "10/26/2026", status: "active" },
  { name: "Tori Mehlberg", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "6/26/2026", lastApptDate: "10/29/2026", status: "active" },
  { name: "Kamryn Moss", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "12/18/2025", lastApptDate: "10/23/2026", status: "active" },
  { name: "Kassidy Nicholse", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "5/26/2026", lastApptDate: "10/26/2026", status: "active" },
  { name: "Randall Ravanelli", clinician: "Chelsee Jackson", frequency: "Weekly", startDate: "6/11/2026", lastApptDate: "10/26/2026", status: "active" },

  // J. Johnson
  { name: "Kenzie Barlow", clinician: "Jen Johnson", frequency: "Weekly", startDate: "12/2/2025", lastApptDate: "9/8/2026", status: "active" },
  { name: "Jeremy Broadwell", clinician: "Jen Johnson", frequency: "Weekly", startDate: "9/4/2024", lastApptDate: "8/26/2026", status: "active" },
  { name: "Kris W Erickson", clinician: "Jen Johnson", frequency: "Weekly", startDate: "11/8/2024", lastApptDate: "8/26/2026", status: "active" },
  { name: "Will Heyborne", clinician: "Jen Johnson", frequency: "Weekly", startDate: "4/2/2026", lastApptDate: "9/9/2026", status: "active" },
  { name: "Madi Hansen", clinician: "Jen Johnson", frequency: "Every other week", startDate: "1/30/2025", lastApptDate: "9/2/2026", status: "active" },
  { name: "Olivia Lake", clinician: "Jen Johnson", frequency: "Every other week", startDate: "4/7/2025", lastApptDate: "8/26/2026", status: "active" },
  { name: "Kloiee Anne Mason", clinician: "Jen Johnson", frequency: "Every other week", startDate: "10/1/2024", lastApptDate: "9/2/2026", status: "active" },

  // K. Carter
  { name: "Sarah Louise Barrett", clinician: "Keri Carter", frequency: "Every other week", startDate: "7/23/2025", lastApptDate: "10/26/2026", status: "active" },
  { name: "Shaylee Chappell", clinician: "Keri Carter", frequency: "Every other week", startDate: "7/3/2025", lastApptDate: "10/7/2026", status: "active" },
  { name: "Ashlyn Emily Cowdell", clinician: "Keri Carter", frequency: "Monthly", startDate: "4/22/2025", lastApptDate: "9/29/2026", status: "active" },
  { name: "Ethan Cutler", clinician: "Keri Carter", frequency: "Every other week", startDate: "4/3/2026", lastApptDate: "10/16/2026", status: "active" },
  { name: "Sandy Davis", clinician: "Keri Carter", frequency: "Every other week", startDate: "6/4/2025", lastApptDate: "10/13/2026", status: "active" },
  { name: "Lei Caroline Foster", clinician: "Keri Carter", frequency: "Weekly", startDate: "2/3/2026", lastApptDate: "10/5/2026", status: "active" },
  { name: "Ariana Greene", clinician: "Keri Carter", frequency: "Weekly", startDate: "10/2/2025", lastApptDate: "10/22/2026", status: "active" },
  { name: "Rylee Johnson", clinician: "Keri Carter", frequency: "Weekly", startDate: "6/10/2025", lastApptDate: "10/26/2026", status: "active" },
  { name: "Kie Luong", clinician: "Keri Carter", frequency: "Weekly", startDate: "12/18/2025", lastApptDate: "10/26/2026", status: "active" },
  { name: "Bree Hailey Mann", clinician: "Keri Carter", frequency: "Weekly", startDate: "10/13/2025", lastApptDate: "10/22/2026", status: "active" },
  { name: "Lauryn Tyler Mower", clinician: "Keri Carter", frequency: "Weekly", startDate: "9/10/2025", lastApptDate: "10/22/2026", status: "active" },
  { name: "Julianna Evelyn Painton", clinician: "Keri Carter", frequency: "Monthly", startDate: "8/1/2025", lastApptDate: "10/23/2026", status: "active" },
  { name: "Jessica Sanders", clinician: "Keri Carter", frequency: "Weekly", startDate: "3/26/2026", lastApptDate: "9/23/2026", status: "active" },
  { name: "Alisha Soracco", clinician: "Keri Carter", frequency: "Every other week", startDate: "5/19/2025", lastApptDate: "10/19/2026", status: "active" },
  { name: "Katie Leigh Steffey Vest", clinician: "Keri Carter", frequency: "Weekly", startDate: "12/8/2025", lastApptDate: "10/23/2026", status: "active" },
  { name: "Zariah Willis Attakai", clinician: "Keri Carter", frequency: "Weekly", startDate: "8/5/2026", lastApptDate: "10/21/2026", status: "active" },
  { name: "Aunna Mae Brinton", clinician: "Keri Carter", frequency: "Weekly", startDate: "8/13/2026", lastApptDate: "10/20/2026", status: "active" },
  { name: "Cheyenne Caringi", clinician: "Keri Carter", frequency: "Weekly", startDate: "8/21/2026", lastApptDate: "10/23/2026", status: "active" },
  { name: "Mia Garrison", clinician: "Keri Carter", frequency: "Every other week", startDate: "6/5/2024", lastApptDate: "10/21/2026", status: "active" },
  { name: "Hailey Pleasant", clinician: "Keri Carter", frequency: "Weekly", startDate: "6/30/2026", lastApptDate: "10/20/2026", status: "active" },
  { name: "Lyndi Young", clinician: "Keri Carter", frequency: "Weekly", startDate: "7/14/2026", lastApptDate: "10/20/2026", status: "active" },
  { name: "Grace Wathen", clinician: "Keri Carter", frequency: "Weekly", startDate: "9/28/2026", lastApptDate: "10/6/2026", status: "active" },
  { name: "Alex King", clinician: "Keri Carter", frequency: "Weekly", startDate: "9/23/2026", lastApptDate: "10/20/2026", status: "active" },
  { name: "Jake Mallory", clinician: "Keri Carter", frequency: "Weekly", startDate: "9/18/2026", lastApptDate: "10/16/2026", status: "active" },
  { name: "Joelle Winter", clinician: "Keri Carter", frequency: "Weekly", startDate: "9/3/2026", lastApptDate: "10/22/2026", status: "active" },
  { name: "Dayla Ulrich", clinician: "Keri Carter", frequency: "Weekly", startDate: "11/20/2025", lastApptDate: "10/19/2026", status: "active" },
  { name: "Mistee Robbins", clinician: "Keri Carter", frequency: "Weekly", startDate: "10/16/2026", lastApptDate: "10/16/2026", status: "active" },
  { name: "Olivia Lake", clinician: "Keri Carter", frequency: "Every other week", startDate: "4/7/2025", lastApptDate: "10/21/2026", status: "active" },
  { name: "Kris Erickson", clinician: "Keri Carter", frequency: "Weekly", startDate: "11/8/2024", lastApptDate: "10/28/2026", status: "active" },

  // K. Jones (active only)
  { name: "Lindsey Andersen", clinician: "Kendra Jones", frequency: "Weekly", startDate: "12/12/2023", lastApptDate: "8/27/2025", status: "active" },
  { name: "Ida Barlow", clinician: "Kendra Jones", frequency: "Every other week", startDate: "1/18/2023", lastApptDate: "9/8/2025", status: "active" },
  { name: "Amber Lea Bone", clinician: "Kendra Jones", frequency: "Monthly", startDate: "2/5/2025", lastApptDate: "8/7/2025", status: "active" },
  { name: "Julie Bone", clinician: "Kendra Jones", frequency: "Weekly", startDate: "9/1/2022", lastApptDate: "9/3/2025", status: "active" },
  { name: "Reagan Brown", clinician: "Kendra Jones", frequency: "Monthly", startDate: "2/20/2023", lastApptDate: "8/28/2025", status: "active" },
  { name: "Kay-Lee Cepeda", clinician: "Kendra Jones", frequency: "Every other week", startDate: "10/6/2022", lastApptDate: "9/3/2025", status: "active" },
  { name: "Brittney Ross Corry", clinician: "Kendra Jones", frequency: "Weekly", startDate: "8/13/2024", lastApptDate: "9/2/2025", status: "active" },
  { name: "Jenna Corry", clinician: "Kendra Jones", frequency: "Weekly", startDate: "4/14/2025", lastApptDate: "9/5/2025", status: "active" },
  { name: "Cathy Croft", clinician: "Kendra Jones", frequency: "Weekly", startDate: "4/27/2023", lastApptDate: "9/1/2025", status: "active" },
  { name: "Tamia Dumas", clinician: "Kendra Jones", frequency: "Every other week", startDate: "6/17/2025", lastApptDate: "8/19/2025", status: "active" },
  { name: "Jack Danial Eggan", clinician: "Kendra Jones", frequency: "Weekly", startDate: "9/2/2025", lastApptDate: "9/2/2025", status: "active" },
  { name: "Crystal M Eggen", clinician: "Kendra Jones", frequency: "Weekly", startDate: "8/20/2025", lastApptDate: "9/1/2025", status: "active" },
  { name: "Noctus Lynn Garrison", clinician: "Kendra Jones", frequency: "Monthly", startDate: "7/25/2024", lastApptDate: "8/11/2025", status: "active" },
  { name: "Amanda Greene", clinician: "Kendra Jones", frequency: "Weekly", startDate: "12/16/2024", lastApptDate: "9/2/2025", status: "active" },
  { name: "John Greene", clinician: "Kendra Jones", frequency: "Weekly", startDate: "12/11/2024", lastApptDate: "9/2/2025", status: "active" },
];

// ---- Main ----
async function main() {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Starting retention data migration...`);

  const clinicianMap = await buildClinicianMap();
  console.log(`Loaded ${Object.keys(clinicianMap).length} clinician name mappings`);

  const existingClients = await loadExistingClients();
  console.log(`Loaded ${existingClients.length} existing clients from DB`);

  let imported = 0;
  let backfilled = 0;
  let skipped = 0;

  for (const driveClient of DRIVE_ACTIVE_CLIENTS) {
    const clinicianId = clinicianMap[driveClient.clinician.toLowerCase()];
    if (!clinicianId) {
      console.log(`  SKIP: Unknown clinician "${driveClient.clinician}" for ${driveClient.name}`);
      skipped++;
      continue;
    }

    const freq = mapFrequency(driveClient.frequency);
    const startDate = parseDate(driveClient.startDate);
    const lastApptDate = parseDate(driveClient.lastApptDate);

    // Check if client exists in DB
    const match = fuzzyMatch(driveClient.name, existingClients);

    if (match) {
      // Backfill retention data on existing client
      const raw = await kvGet(`client:${match._id}`);
      if (!raw) continue;
      const client = typeof raw === "string" ? JSON.parse(raw) : raw;

      let changed = false;
      if (!client.clinicianId && clinicianId) { client.clinicianId = clinicianId; changed = true; }
      if (!client.status || client.status === "unknown") { client.status = "active"; changed = true; }
      if (!client.frequency && freq) { client.frequency = freq; changed = true; }
      if (!client.startDate && startDate) { client.startDate = startDate; changed = true; }
      if (!client.lastApptDate && lastApptDate) { client.lastApptDate = lastApptDate; changed = true; }
      // Existing clients keep smsApproved as-is (will be set to true by the migration endpoint)

      if (changed) {
        console.log(`  BACKFILL: ${driveClient.name} => ${match._firstName} ${match._lastName} (${match._id})`);
        if (!DRY_RUN) {
          await kvSet(`client:${match._id}`, JSON.stringify(client));
        }
        backfilled++;
      } else {
        console.log(`  SKIP: ${driveClient.name} already has retention data`);
        skipped++;
      }
    } else {
      // New client — import with smsApproved=false
      const nameParts = driveClient.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "Unknown";

      const id = crypto.randomUUID();
      const client = {
        id,
        firstName: encrypt(firstName),
        lastName: encrypt(lastName),
        phone: encrypt(""),
        clinicianId,
        optedInAt: new Date().toISOString(),
        active: true,
        smsApproved: false,
        status: "active",
        frequency: freq || undefined,
        startDate: startDate || undefined,
        lastApptDate: lastApptDate || undefined,
      };

      console.log(`  IMPORT: ${driveClient.name} => ${driveClient.clinician} (smsApproved=false)`);
      if (!DRY_RUN) {
        await kvSet(`client:${id}`, JSON.stringify(client));
        await kvSadd("client:index", id);
      }
      imported++;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Backfilled: ${backfilled}, Skipped: ${skipped}`);
  if (DRY_RUN) console.log("(dry run — no changes were made)");
}

main().catch(console.error);
