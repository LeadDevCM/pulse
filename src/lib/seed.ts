import { kv } from "@/lib/kv";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { User, Clinician, SurveyTemplate } from "@/types";

export async function seedDatabase() {
  const defaultPassword = await bcrypt.hash("ChangeMeNow!2024", 12);
  const now = new Date().toISOString();

  // Seed clinicians — every therapist/counselor on the team page
  const clinicians: Clinician[] = [
    { id: uuidv4(), name: "Kendra Jones", active: true },
    { id: uuidv4(), name: "Chelsee Jackson", active: true },
    { id: uuidv4(), name: "Ashley Barton", active: true },
    { id: uuidv4(), name: "Shandra Powell", active: true },
    { id: uuidv4(), name: "Keri Carter", active: true },
    { id: uuidv4(), name: "Kelsi Russell", active: true },
    { id: uuidv4(), name: "Dennie Asbury", active: true },
    { id: uuidv4(), name: "Brooklyn Blanchard", active: true },
    { id: uuidv4(), name: "Travis Eide", active: true },
    { id: uuidv4(), name: "Tani Bunker", active: true },
  ];

  for (const c of clinicians) {
    await kv.set(`clinician:${c.id}`, JSON.stringify(c));
    await kv.sadd("clinician:index", c.id);
  }

  const clinicianByName = Object.fromEntries(clinicians.map((c) => [c.name, c.id]));

  // Seed users — partners, clinicians, and office staff
  const users: User[] = [
    {
      id: uuidv4(),
      name: "Kendra Jones",
      email: "kendra@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "partner",
      clinicianId: clinicianByName["Kendra Jones"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Chelsee Jackson",
      email: "chelsee@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "partner",
      clinicianId: clinicianByName["Chelsee Jackson"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Ashley Barton",
      email: "ashley@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Ashley Barton"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Shandra Powell",
      email: "shandra@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Shandra Powell"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Keri Carter",
      email: "keri@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Keri Carter"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Kelsi Russell",
      email: "kelsi@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Kelsi Russell"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Dennie Asbury",
      email: "dennie@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Dennie Asbury"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Brooklyn Blanchard",
      email: "brooklyn@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Brooklyn Blanchard"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Travis Eide",
      email: "travis@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "clinician",
      clinicianId: clinicianByName["Travis Eide"],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Michelle Smock",
      email: "michelle@mendingmindsutah.com",
      passwordHash: defaultPassword,
      role: "office_manager",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Super admin — hidden from all other users
  const ghostPassword = await bcrypt.hash("Gh0st!Pulse2024$", 12);
  users.push({
    id: uuidv4(),
    name: "Ghost",
    email: "ghost@cedarcitywebdesign.com",
    passwordHash: ghostPassword,
    role: "super_admin",
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  for (const u of users) {
    await kv.set(`user:${u.id}`, JSON.stringify(u));
    await kv.sadd("user:index", u.id);
    await kv.set(`user:email:${u.email}`, u.id);
  }

  // Seed default survey template
  const template: SurveyTemplate = {
    id: uuidv4(),
    name: "Post-Session Feedback",
    questions: [
      {
        id: uuidv4(),
        text: "On a scale of 1–7, how heard, respected, and supported did you feel by your therapist?",
        type: "rating",
        ratingScale: { min: 1, max: 7, minLabel: "Not at all", maxLabel: "Completely" },
        required: true,
        order: 1,
      },
      {
        id: uuidv4(),
        text: "On a scale of 1–7, how satisfied were you with your overall experience at Mending Minds Therapy?",
        type: "rating",
        ratingScale: { min: 1, max: 7, minLabel: "Not satisfied", maxLabel: "Very satisfied" },
        required: true,
        order: 2,
      },
      {
        id: uuidv4(),
        text: "Is there anything we could do to improve your experience or help you feel better supported?",
        type: "free_text",
        required: false,
        order: 3,
      },
    ],
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`survey:template:${template.id}`, JSON.stringify(template));
  await kv.sadd("survey:template:index", template.id);

  return { users: users.length, clinicians: clinicians.length, templates: 1 };
}
