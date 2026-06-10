"use client";

import { useEffect, useState } from "react";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AddClientForm from "./AddClientForm";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  clinicianId: string;
  optedInAt: string;
}

export default function ClientRoster() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const { addToast } = useToast();

  const loadClients = () => {
    setLoading(true);
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadClients(); }, []);

  const removeClient = async (id: string) => {
    if (!confirm("Remove this client from the survey roster?")) return;
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("Client removed", "success");
      loadClients();
    } else {
      addToast("Failed to remove client", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">{clients.length} opted-in clients</p>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <IconPlus size={16} className="mr-1" /> Add Client
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Loading...</div>
      ) : (
        <Table headers={["Name", "Phone", "Opted In", ""]}>
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-bg-alt">
              <td className="px-4 py-3 text-sm font-medium text-text">{c.name}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{c.phone}</td>
              <td className="px-4 py-3">
                <Badge variant="success">{new Date(c.optedInAt).toLocaleDateString()}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => removeClient(c.id)}
                  className="p-1 text-text-secondary hover:text-error transition-colors"
                >
                  <IconTrash size={18} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Client">
        <AddClientForm
          onSuccess={() => {
            setShowAdd(false);
            loadClients();
            addToast("Client added to roster", "success");
          }}
        />
      </Modal>
    </div>
  );
}
