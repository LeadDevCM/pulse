import SendTrigger from "@/components/admin/SendTrigger";

export default function SendPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Send Survey</h2>
        <p className="text-text-secondary mt-1">
          Send a survey link to a specific client
        </p>
      </div>
      <div className="max-w-lg">
        <SendTrigger />
      </div>
    </div>
  );
}
