// Barrel exports for the Phase 1 domain layer.
// Prefer `import { ... } from "@/lib/domain"` over deep paths so module
// boundaries can evolve without rippling through call sites.
//
// Note: `isFinalizedStatus` is also exported from `@/lib/data` for the legacy
// `LifecycleStatus` type. Don't import both in the same file — TS will flag the
// collision, which is the desired forcing function to migrate to RecordStatus.
export * from "./allocation";
export * from "./audit";
export * from "./commodity";
export * from "./commodity-rules";
export * from "./commodityRules";
export * from "./invariants";
export * from "./lifecycle";
export * from "./metrics";
export * from "./severity";
export * from "./status";
export * from "./units";
export * from "./utilization";
export * from "./validation";
