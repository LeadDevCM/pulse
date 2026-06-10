import ClientRoster from "@/components/admin/ClientRoster";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Client Roster</h2>
        <p className="text-text-secondary mt-1">
          Manage opted-in clients for survey distribution
        </p>
      </div>
      <ClientRoster />
    </div>
  );
}
