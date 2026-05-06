export function normalizeSortKey(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLocaleLowerCase();
}

/**
 * Case-insensitive A→Z compare that ignores leading/trailing spaces.
 * - Blank values sort last.
 */
export function compareAZ(a: unknown, b: unknown): number {
  const ka = normalizeSortKey(a);
  const kb = normalizeSortKey(b);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  return ka.localeCompare(kb, undefined, { sensitivity: "base" });
}

export function sortBy<T>(arr: readonly T[], key: (t: T) => unknown): T[] {
  return [...arr].sort((a, b) => compareAZ(key(a), key(b)));
}

export function sortByThen<T>(
  arr: readonly T[],
  key1: (t: T) => unknown,
  key2: (t: T) => unknown,
): T[] {
  return [...arr].sort((a, b) => compareAZ(key1(a), key1(b)) || compareAZ(key2(a), key2(b)));
}

