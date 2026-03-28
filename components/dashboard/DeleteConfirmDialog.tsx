"use client";
import { AlertTriangle, X } from "lucide-react";
import type { AgriRecord } from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";

type Props = {
  open: boolean;
  onClose: () => void;
  record: AgriRecord | null;
};

export default function DeleteConfirmDialog({ open, onClose, record }: Props) {
  const { deleteRecord } = useAgriData();

  if (!open || !record) return null;

  function handleDelete() {
    if (record) {
      deleteRecord(record.id);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-2">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Delete Record</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to delete this record? This action cannot be undone.
        </p>
        <div className="mb-5 rounded-lg bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-700">{record.barangay}</p>
          <p className="text-xs text-gray-500">
            {record.commodity} · {record.sub_category}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleDelete} className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 transition">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
