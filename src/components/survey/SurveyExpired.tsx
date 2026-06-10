import { IconClockOff } from "@tabler/icons-react";

export default function SurveyExpired() {
  return (
    <div className="text-center space-y-4 py-8">
      <IconClockOff size={56} className="text-text-secondary mx-auto" />
      <h2 className="text-xl font-semibold text-text">Survey Unavailable</h2>
      <p className="text-text-secondary max-w-sm mx-auto">
        This survey is no longer available. If you believe this is an error,
        please contact our office.
      </p>
    </div>
  );
}
