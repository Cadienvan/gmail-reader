/**
 * Minimal classname combiner. Joins truthy class fragments with a space.
 * Kept dependency-free on purpose (no clsx/tailwind-merge) — later fragments
 * win by source order, which is enough for our component variants.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
