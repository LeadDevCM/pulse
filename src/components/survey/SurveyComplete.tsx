import { IconCircleCheck } from "@tabler/icons-react";

export default function SurveyComplete() {
  return (
    <div className="text-center space-y-4 py-8">
      <IconCircleCheck size={56} className="text-primary mx-auto" />
      <h2 className="text-xl font-semibold text-text">Thank You</h2>
      <p className="text-text-secondary max-w-sm mx-auto">
        Your feedback helps us provide better care. You may close this page.
      </p>
    </div>
  );
}
