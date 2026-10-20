// Ids for `smoove new`. A leaf module on purpose: commands.ts and new.ts both
// import it, and a constant inside new.ts would be read before it exists when
// new.js is the first module loaded.

/** Lowercase words joined by dashes. */
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Product launch!" → "product-launch". Empty when the title has no letters or digits. */
export function kebab(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
