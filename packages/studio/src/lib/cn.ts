/** Join truthy class fragments (arrays are flattened). */
export function cn(...parts: Array<string | false | null | undefined | string[]>): string {
  return parts
    .flat(Number.POSITIVE_INFINITY as 1)
    .filter(Boolean)
    .join(" ");
}
