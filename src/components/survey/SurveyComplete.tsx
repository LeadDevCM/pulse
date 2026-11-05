import { IconCircleCheck, IconStarFilled } from "@tabler/icons-react";

const GOOGLE_REVIEW_URL = "https://g.page/r/CcF3Kzztz-5wEBM/review";

export default function SurveyComplete() {
  return (
    <div className="text-center space-y-6 py-8">
      <IconCircleCheck size={56} className="text-primary mx-auto" />
      <h2 className="text-xl font-semibold text-text">Thank You</h2>
      <p className="text-text-secondary max-w-sm mx-auto">
        Your feedback helps us provide better care.
      </p>
      <div className="border-t border-border pt-6 max-w-sm mx-auto">
        <p className="text-text-secondary text-sm mb-3">
          If you had a positive experience, a Google review helps others find the support they need.
        </p>
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-alt text-text hover:bg-primary hover:text-white transition-colors text-sm font-medium"
        >
          <IconStarFilled size={16} />
          Leave a Google Review
        </a>
      </div>
    </div>
  );
}
