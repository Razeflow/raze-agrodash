"use client";

import { AlertCircle } from "lucide-react";

export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
      {children} {required ? <span className="text-red-400">*</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
      <AlertCircle size={11} /> {message}
    </p>
  );
}

export const inputCls =
  "w-full rounded-[1.5rem] border border-slate-200/50 bg-white/50 backdrop-blur px-3 py-2.5 sm:py-2 text-base sm:text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition disabled:opacity-60 disabled:cursor-not-allowed";

export const inputErrCls =
  "w-full rounded-[1.5rem] border border-red-300 bg-red-50/30 backdrop-blur px-3 py-2.5 sm:py-2 text-base sm:text-sm text-gray-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition disabled:opacity-60 disabled:cursor-not-allowed";

