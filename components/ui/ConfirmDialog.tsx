"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAnimatedMount } from "@/hooks/useAnimatedMount";
import DialogPortal from "@/components/ui/DialogPortal";
import { normalizeSortKey } from "@/lib/sort";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  typeToConfirmText?: string;
  /** Return `false` to keep dialog open (e.g. mutation failed). */
  onConfirm: () => void | false | Promise<void | false>;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  typeToConfirmText,
  onConfirm,
  onClose,
}: Props) {
  const { mounted, visible } = useAnimatedMount(open);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped("");
      setWorking(false);
      queueMicrotask(() => cancelRef.current?.focus());
    }
  }, [open]);

  const typeNeeded = useMemo(() => {
    const t = typeof typeToConfirmText === "string" ? typeToConfirmText.trim() : "";
    return t || null;
  }, [typeToConfirmText]);

  const typeOk = useMemo(() => {
    if (!typeNeeded) return true;
    return normalizeSortKey(typed) === normalizeSortKey(typeNeeded);
  }, [typed, typeNeeded]);

  if (!mounted) return null;

  async function handleConfirm() {
    if (!typeOk || working) return;
    setWorking(true);
    try {
      const res = await onConfirm();
      if (res !== false) onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <DialogPortal>
      <div className="fixed inset-0 lg:left-24 z-[80] overflow-y-auto">
        <div
          className={`fixed inset-0 dialog-overlay ${visible ? "dialog-overlay-visible" : ""}`}
          onClick={onClose}
        />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`relative z-10 w-full max-w-md rounded-[2rem] bg-white/92 backdrop-blur-xl border border-white/40 p-7 shadow-2xl dialog-panel ${
              visible ? "dialog-panel-visible" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`p-3 rounded-2xl ${danger ? "bg-red-100" : "bg-slate-100"}`}>
                  <AlertTriangle size={18} className={danger ? "text-red-500" : "text-slate-500"} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl p-1 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {description ? <p className="mb-3 text-sm text-slate-600">{description}</p> : null}

            {typeNeeded ? (
              <div className="mb-5">
                <p className="text-xs text-slate-500 mb-2">
                  Type <span className="font-black text-slate-700">{typeNeeded}</span> to confirm.
                </p>
                <input
                  className="w-full rounded-[1.5rem] border border-slate-200/60 bg-white/70 px-4 py-2 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type to confirm…"
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                className="rounded-[1.5rem] border border-white/40 bg-white/50 px-4 py-2 text-sm text-slate-600 hover:bg-white/70 transition"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!typeOk || working}
                className={`rounded-[1.5rem] px-5 py-2 text-sm font-black text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  danger ? "bg-red-500 hover:bg-red-600" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {working ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

