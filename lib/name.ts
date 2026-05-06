import { normalizeSortKey } from "./sort";

/**
 * Heuristic name split for existing single-string storage:
 * - Last name = last token
 * - First+middle = everything before the last token
 *
 * Examples:
 * - "Juan Dela Cruz" -> last: "Cruz", firstMiddle: "Juan Dela"
 * - "Madonna"        -> last: "Madonna", firstMiddle: ""
 */
export function splitHumanName(raw: string): { last: string; firstMiddle: string } {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { last: "", firstMiddle: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { last: parts[0], firstMiddle: "" };
  return { last: parts[parts.length - 1], firstMiddle: parts.slice(0, -1).join(" ") };
}

export function lastNameSortKey(raw: string): string {
  const { last } = splitHumanName(raw);
  return normalizeSortKey(last);
}

export function fullNameSortKey(raw: string): string {
  return normalizeSortKey(raw);
}

export function displayNameParts(raw: string): { last: string; firstMiddle: string } {
  const { last, firstMiddle } = splitHumanName(raw);
  return { last: last.trim(), firstMiddle: firstMiddle.trim() };
}

export function combineNameParts(last: string, first: string, middle: string): string {
  const l = (last ?? "").trim();
  const f = (first ?? "").trim();
  const m = (middle ?? "").trim();
  return [f, m, l].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

