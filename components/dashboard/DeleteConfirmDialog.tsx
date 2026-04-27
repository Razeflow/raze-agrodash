"use client";
import { AlertTriangle, X } from "lucide-react";
import type { AgriRecord } from "@/lib/data";
import { useAgriData } from "@/lib/agri-context";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  record: AgriRecord | null;
};

export default function DeleteConfirmDialog({ open, onClose, record }: Props) {
  const { deleteRecord } = useAgriData();
  const { mounted, visible } = useAnimatedMount(open);

  if (!mounted || !record) return null;

  function handleDelete() {
    if (record) {
      deleteRecord(record.id);
      onClose();
    }
  }

  return (
    <DialogPortal>
    <div className="fixed inset-0 lg:left-24 z-50 overflow-y-auto">
      <div className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`} onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
      <div className={`relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-8 shadow-2xl dialog-panel ${visible ? "dialog-panel-visible" : ""}`}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-red-100">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Delete Record</h2>
          </div>
          <button onClick={onClose} className="rounded-2xl p-1 hover:bg-slate-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to delete this record? This action cannot be undone.
        </p>
        <div className="mb-5 rounded-2xl bg-white/50 backdrop-blur border border-slate-200/50 p-3">
          <p className="text-sm font-semibold text-gray-700">{record.barangay}</p>
          <p className="text-xs text-gray-500">
            {record.commodity} · {record.sub_category}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/70 transition">
            Cancel
          </button>
          <button onClick={handleDelete} className="rounded-[1.5rem] bg-red-500 px-5 py-2 text-sm font-black text-white hover:bg-red-600 transition">
            Delete
          </button>
        </div>
      </div>
      </div>
    </div>
    </DialogPortal>
  );
}
