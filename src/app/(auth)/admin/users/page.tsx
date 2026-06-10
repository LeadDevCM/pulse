import UserManager from "@/components/admin/UserManager";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text">User Management</h2>
        <p className="text-text-secondary mt-1">
          Manage staff access to the Pulse dashboard
        </p>
      </div>
      <UserManager />
    </div>
  );
}
