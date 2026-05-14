"use client";

/**
 * Phase 5 / refactor step C — FarmersProvider.
 *
 * Owns the *context surface* for the Farmers domain (farmer profiles, farmer
 * assets, and farmer↔organization join rows). State + mutation implementations
 * still live in AgriDataProvider; this file defines the types, context,
 * provider wrapper, and `useFarmers()` hook so consumers can subscribe to this
 * slice in isolation.
 *
 * Cross-cutting mutations like `updateFarmer` / `deleteFarmer` (which also
 * recompute denormalized farmer fields on `agri_records`) intentionally stay
 * in agri-context.tsx — they coordinate state across multiple domains.
 */

import { createContext, useContext, type ReactNode } from "react";
import type {
  Farmer,
  FarmerAsset,
  FarmerAssetCategory,
  FarmerOrganizationRow,
} from "@/lib/data";

export type MutationResult = { ok: true } | { ok: false; message: string };

export type AddFarmerInput = Omit<Farmer, "id" | "created_at" | "updated_at"> & {
  /** Optional display name when creating a new household alongside the farmer. */
  new_household_display_name?: string | null;
};

export type AddFarmerResult = { ok: true; id: string } | { ok: false; message: string };

export type AddFarmerAssetResult =
  | { ok: true; asset: FarmerAsset }
  | { ok: false; message: string };

export type FarmersContextValue = {
  farmers: Farmer[];
  farmerOrganizations: FarmerOrganizationRow[];
  addFarmer: (farmer: AddFarmerInput) => Promise<AddFarmerResult>;
  updateFarmer: (
    id: string,
    farmer: Omit<Farmer, "id" | "created_at" | "updated_at">,
  ) => Promise<MutationResult>;
  deleteFarmer: (id: string) => Promise<void>;
  getFarmersByIds: (ids: string[]) => Farmer[];
  getOrganizationIdsForFarmer: (farmerId: string) => string[];
  saveFarmerOrganizations: (farmerId: string, organizationIds: string[]) => Promise<MutationResult>;
  farmerAssets: FarmerAsset[];
  getAssetsForFarmer: (farmerId: string) => FarmerAsset[];
  addFarmerAsset: (row: {
    farmer_id: string;
    category: FarmerAssetCategory;
    sub_category?: string | null;
    product_detail?: string | null;
    quantity?: number | null;
    unit?: string | null;
    area_hectares?: number | null;
    acquired_date?: string | null;
    notes?: string | null;
    parcel_label?: string | null;
    parcel_code?: string | null;
    centroid_lat?: number | null;
    centroid_lng?: number | null;
  }) => Promise<AddFarmerAssetResult>;
  updateFarmerAsset: (
    id: string,
    patch: Partial<{
      category: FarmerAssetCategory;
      sub_category: string | null;
      product_detail: string | null;
      quantity: number | null;
      unit: string | null;
      area_hectares: number | null;
      acquired_date: string | null;
      notes: string | null;
      parcel_label: string | null;
      parcel_code: string | null;
      centroid_lat: number | null;
      centroid_lng: number | null;
    }>,
  ) => Promise<MutationResult>;
  deleteFarmerAsset: (id: string) => Promise<MutationResult>;
};

const FarmersContext = createContext<FarmersContextValue | null>(null);

export function FarmersProvider({
  value,
  children,
}: {
  value: FarmersContextValue;
  children: ReactNode;
}) {
  return <FarmersContext.Provider value={value}>{children}</FarmersContext.Provider>;
}

export function useFarmers(): FarmersContextValue {
  const ctx = useContext(FarmersContext);
  if (!ctx) throw new Error("useFarmers must be used within FarmersProvider");
  return ctx;
}

export { FarmersContext };
