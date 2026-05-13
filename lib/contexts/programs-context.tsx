"use client";

/**
 * Phase 5 / refactor step B — ProgramsProvider.
 *
 * Owns the *context surface* for the Programs domain (households, organizations,
 * household subsidies). State + mutation implementations still live in
 * AgriDataProvider; this file defines the types, context, provider wrapper,
 * and `usePrograms()` hook so consumers can subscribe to this slice in isolation.
 *
 * Cross-cutting mutations like `deleteOrganization` (which also mirrors
 * `farmer_organizations` + `households.organization_id`) intentionally stay in
 * agri-context.tsx — they coordinate state across multiple domains.
 */

import { createContext, useContext, type ReactNode } from "react";
import type {
  Household,
  HouseholdSubsidy,
  Organization,
  SubsidyCategory,
} from "@/lib/data";

export type MutationResult = { ok: true } | { ok: false; message: string };

export type AddOrganizationResult =
  | { ok: true; organization: Organization }
  | { ok: false; message: string };

export type AddHouseholdSubsidyResult =
  | { ok: true; subsidy: HouseholdSubsidy }
  | { ok: false; message: string };

export type ProgramsContextValue = {
  households: Household[];
  organizations: Organization[];
  getHousehold: (id: string | null) => Household | undefined;
  addHousehold: (h: Omit<Household, "id" | "created_at" | "updated_at">) => Promise<Household | null>;
  updateHousehold: (
    id: string,
    h: Partial<Omit<Household, "id" | "created_at" | "updated_at">>,
  ) => Promise<MutationResult>;
  deleteHousehold: (id: string) => Promise<void>;
  addOrganization: (
    o: Omit<Organization, "id" | "created_at" | "updated_at">,
  ) => Promise<AddOrganizationResult>;
  updateOrganization: (
    id: string,
    o: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>,
  ) => Promise<void>;
  deleteOrganization: (id: string) => Promise<MutationResult>;
  householdSubsidies: HouseholdSubsidy[];
  getSubsidiesForHousehold: (householdId: string) => HouseholdSubsidy[];
  addHouseholdSubsidy: (row: {
    household_id: string;
    category: SubsidyCategory;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    amount_php?: number | null;
    program_source?: string | null;
    received_date?: string | null;
    notes?: string | null;
  }) => Promise<AddHouseholdSubsidyResult>;
  updateHouseholdSubsidy: (
    id: string,
    patch: Partial<{
      category: SubsidyCategory;
      product_detail: string | null;
      quantity: number | null;
      unit: string | null;
      amount_php: number | null;
      program_source: string | null;
      received_date: string | null;
      notes: string | null;
    }>,
  ) => Promise<MutationResult>;
  deleteHouseholdSubsidy: (id: string) => Promise<MutationResult>;
};

const ProgramsContext = createContext<ProgramsContextValue | null>(null);

export function ProgramsProvider({
  value,
  children,
}: {
  value: ProgramsContextValue;
  children: ReactNode;
}) {
  return <ProgramsContext.Provider value={value}>{children}</ProgramsContext.Provider>;
}

export function usePrograms(): ProgramsContextValue {
  const ctx = useContext(ProgramsContext);
  if (!ctx) throw new Error("usePrograms must be used within ProgramsProvider");
  return ctx;
}

export { ProgramsContext };
