import { kv } from "@vercel/kv";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { User, Clinician, SurveyTemplate } from "@/types";

export async function seedDatabase() {
  // Seed clinicians
  const clinicians: Clinician[] = [
    { id: uuidv4(), name: "Keri", active: true },
  ];

  for (const c of clinicians) {
    await kv.set(`clinician:${c.id}`, JSON.stringify(c));
    await kv.sadd("clinician:index", c.id);
  }

  // Seed users
  const defaultPassword = await bcrypt.hash("ChangeMeNow!2024", 12);
  const now = new Date().toISOString();

  const users: User[] = [
    {
      id: uuidv4(),
      name: "Kendra Jones",
      email: "kendra@mendingmindstherapy.com",
      passwordHash: defaultPassword,
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Chelsee Jackson",
      email: "chelsee@mendingmindstherapy.com",
      passwordHash: defaultPassword,
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: "Kayley",
      email: "kayley@mendingmindstherapy.com",
      passwordHash: defaultPassword,
      role: "office_manager",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Link Keri clinician to a user if needed
  const keriUser: User = {
    id: uuidv4(),
    name: "Keri",
    email: "keri@mendingmindstherapy.com",
    passwordHash: defaultPassword,
    role: "clinician",
    clinicianId: clinicians[0].id,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  users.push(keriUser);

  for (const u of users) {
    await kv.set(`user:${u.id}`, JSON.stringify(u));
    await kv.sadd("user:index", u.id);
    await kv.set(`user:email:${u.email}`, u.id);
  }

  // Seed default survey template
  const template: SurveyTemplate = {
    id: uuidv4(),
    name: "Post-Session Feedback v1",
    questions: [
      {
        id: uuidv4(),
        text: "How are you feeling after today's session?",
        type: "rating",
        ratingScale: { min: 1, max: 5, minLabel: "Much worse", maxLabel: "Much better" },
        required: true,
        order: 1,
      },
      {
        id: uuidv4(),
        text: "Did you feel heard and understood today?",
        type: "rating",
        ratingScale: { min: 1, max: 5, minLabel: "Not at all", maxLabel: "Completely" },
        required: true,
        order: 2,
      },
      {
        id: uuidv4(),
        text: "How likely are you to recommend Mending Minds to someone you know?",
        type: "rating",
        ratingScale: { min: 1, max: 10, minLabel: "Not likely", maxLabel: "Very likely" },
        required: true,
        order: 3,
      },
      {
        id: uuidv4(),
        text: "Is there anything you'd like us to know?",
        type: "free_text",
        required: false,
        order: 4,
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
