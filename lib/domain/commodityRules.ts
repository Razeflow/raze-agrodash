import type { CommodityGroup } from "./commodity";
import type { Unit } from "./units";

export type CommodityRuleSet = {
  group: CommodityGroup;
  baseLabel: string;
  baseUnit: Unit;
  outputLabel: string;
  outputUnit: Unit;
  lossLabel: string;
  lossUnit: Unit;
  supportsHectares: boolean;
};

export const RULES: Record<CommodityGroup, CommodityRuleSet> = {
  CROP: {
    group: "CROP",
    baseLabel: "Planting area",
    baseUnit: "ha",
    outputLabel: "Harvest output",
    outputUnit: "bags",
    lossLabel: "Damage",
    lossUnit: "ha",
    supportsHectares: true,
  },
  FISHERY: {
    group: "FISHERY",
    baseLabel: "Stocking",
    baseUnit: "pieces",
    outputLabel: "Harvest output",
    outputUnit: "pieces",
    lossLabel: "Loss",
    lossUnit: "pieces",
    supportsHectares: false,
  },
  LIVESTOCK: {
    group: "LIVESTOCK",
    baseLabel: "Stocking",
    baseUnit: "heads",
    outputLabel: "Output",
    outputUnit: "heads",
    lossLabel: "Dead",
    lossUnit: "heads",
    supportsHectares: false,
  },
};

