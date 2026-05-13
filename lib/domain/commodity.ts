import type { AgriRecord } from "@/lib/data";

export type CommodityGroup = "CROP" | "FISHERY" | "LIVESTOCK";

export const COMMODITY_GROUPS: CommodityGroup[] = ["CROP", "FISHERY", "LIVESTOCK"];

export function commodityGroupForCommodity(commodity: AgriRecord["commodity"]): CommodityGroup {
  if (commodity === "Fishery") return "FISHERY";
  if (commodity === "Livestock") return "LIVESTOCK";
  return "CROP";
}

