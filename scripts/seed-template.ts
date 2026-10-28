import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

async function main() {
  const now = new Date().toISOString();
  const templateId = randomUUID();

  const template = {
    id: templateId,
    name: "Post-Session Feedback",
    questions: [
      {
        id: randomUUID(),
        text: "On a scale of 1–7, how heard, respected, and supported did you feel by your therapist?",
        type: "rating",
        ratingScale: { min: 1, max: 7, minLabel: "Not at all", maxLabel: "Completely" },
        required: true,
        order: 1,
      },
      {
        id: randomUUID(),
        text: "On a scale of 1–7, how satisfied were you with your overall experience at Mending Minds Therapy?",
        type: "rating",
        ratingScale: { min: 1, max: 7, minLabel: "Not satisfied", maxLabel: "Very satisfied" },
        required: true,
        order: 2,
      },
      {
        id: randomUUID(),
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

  await kv.set(`survey:template:${templateId}`, JSON.stringify(template));
  await kv.sadd("survey:template:index", templateId);

  console.log("Created survey template:", { id: templateId, name: template.name, questions: template.questions.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
