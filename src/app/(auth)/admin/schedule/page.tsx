import BatchScheduler from "@/components/admin/BatchScheduler";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Schedule Surveys</h2>
        <p className="text-text-secondary mt-1">
          Create a batch of surveys to send after appointments
        </p>
      </div>
      <BatchScheduler />
    </div>
  );
}
