/**
 * Resolve column index by header name or fallback to numeric index.
 * Uses case-insensitive, trimmed matching. Fallback to colIndex only if column count matches (backward compat).
 */
export function resolveColumnIndex(
  columns: string[],
  columnName?: string,
  colIndex?: number
): number | null {
  if (columnName != null && columnName !== '') {
    const normalized = String(columnName).trim().toLowerCase();
    const idx = columns.findIndex(
      (c) => c != null && String(c).trim().toLowerCase() === normalized
    );
    if (idx >= 0) return idx;
    return null;
  }
  if (colIndex != null && colIndex >= 0 && colIndex < columns.length) {
    return colIndex;
  }
  return null;
}
