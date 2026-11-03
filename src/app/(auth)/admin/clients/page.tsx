"use client";

import RetentionManager from "@/components/admin/RetentionManager";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Clients</h2>
        <p className="text-text-secondary mt-1">
          Manage client roster, retention status, and session details
        </p>
      </div>
      <RetentionManager />
    </div>
  );
}
