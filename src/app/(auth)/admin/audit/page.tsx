import AuditLogViewer from "@/components/admin/AuditLogViewer";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Audit Log</h2>
        <p className="text-text-secondary mt-1">
          HIPAA-compliant access and activity log -- retained for 6 years
        </p>
      </div>
      <AuditLogViewer />
    </div>
  );
}
