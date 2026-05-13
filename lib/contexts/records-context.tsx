"use client";

/**
 * Phase 5 / refactor step D — RecordsProvider.
 *
 * Owns the *context surface* for the Records domain (agri_records and its
 * mutations). State + mutation implementations still live in AgriDataProvider;
 * this file defines the types, context, provider wrapper, and `useRecords()`
 * hook so consumers can subscribe to this slice in isolation.
 *
 * The mutation implementations in agri-context.tsx already perform cross-domain
 * validation (`validateHouseholdCropAllocation` reads farmers + households via
 * refs at mutation time) and stay there to avoid context-of-contexts coupling.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { AgriRecord } from "@/lib/data";

export type MutationResult = { ok: true } | { ok: false; message: string };

export type AddRecordResult = { ok: true } | { ok: false; message: string };

/** Form-side payload — server-set / denormalized fields are stripped. */
export type RecordMutationPayload = Omit<
  AgriRecord,
  "id" | "created_at" | "updated_at" | "total_farmers" | "farmer_names" | "farmer_male" | "farmer_female"
>;

export type RecordsContextValue = {
  records: AgriRecord[];
  addRecord: (record: RecordMutationPayload) => Promise<AddRecordResult>;
  updateRecord: (id: string, record: RecordMutationPayload) => Promise<MutationResult>;
  deleteRecord: (id: string) => void;
};

const RecordsContext = createContext<RecordsContextValue | null>(null);

export function RecordsProvider({
  value,
  children,
}: {
  value: RecordsContextValue;
  children: ReactNode;
}) {
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsContextValue {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error("useRecords must be used within RecordsProvider");
  return ctx;
}

export { RecordsContext };
