"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconTrash } from "@tabler/icons-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export default function UserManager() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("clinician");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadUsers = () => {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { setUsers(data.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (res.ok) {
      addToast("User created", "success");
      setShowAdd(false);
      setName(""); setEmail(""); setPassword(""); setRole("clinician");
      loadUsers();
    } else {
      const data = await res.json();
      addToast(data.error || "Failed to create user", "error");
    }
    setSaving(false);
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("User deactivated", "success");
        loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Failed to deactivate user", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">{users.length} users</p>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <IconPlus size={16} className="mr-1" /> Add User
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Loading...</div>
      ) : (
        <Table headers={["Name", "Email", "Role", "Status", ""]}>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-bg-alt">
              <td className="px-4 py-3 text-sm font-medium text-text">{u.name}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{u.email}</td>
              <td className="px-4 py-3"><Badge>{u.role.replace("_", " ")}</Badge></td>
              <td className="px-4 py-3">
                <Badge variant={u.active ? "success" : "error"}>{u.active ? "Active" : "Inactive"}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => deleteUser(u.id)}
                  disabled={deleting === u.id}
                  className="p-1 text-text-secondary hover:text-error transition-colors disabled:opacity-50"
                >
                  <IconTrash size={18} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add User">
        <form onSubmit={createUser} className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 12 characters" required />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: "owner", label: "Owner" },
              { value: "clinician", label: "Clinician" },
              { value: "office_manager", label: "Office Manager" },
            ]}
          />
          <Button type="submit" loading={saving} className="w-full">Create User</Button>
        </form>
      </Modal>
    </div>
  );
}
