import { Block, type Composition, type Sequence } from "@smoove/core";

export interface CodeTheme {
  page: string;
  card: string;
  border: string;
  /** Default text color for the code (matches the theme). */
  fill: string;
}

export const codeThemes: Record<"dark" | "light", CodeTheme> = {
  dark: { page: "#171b24", card: "#232a37", border: "#333b4b", fill: "#d8dee9" },
  light: { page: "#e8ebf1", card: "#ffffff", border: "#d6dbe4", fill: "#3b4252" },
};

/**
 * Add a themed, full-frame background to `main` that flex-centers a rounded card,
 * sizing itself from the composition. Returns the card `Block` so you can drop
 * your `Code` node into it. Style the code with `codeThemes[theme].fill`.
 */
export function codeCard(
  comp: Composition,
  main: Sequence,
  theme: "dark" | "light" = "dark",
): Block {
  const t = codeThemes[theme];

  const card = new Block({
    padding: 28,
    background: t.card,
    cornerRadius: 18,
    borderSize: 1,
    borderColor: t.border,
  });

  const bg = new Block({
    x: 0,
    y: 0,
    width: comp.width(),
    height: comp.height(),
    justifyContent: "center",
    alignItems: "center",
    background: t.page,
  });
  bg.add(card);
  main.add(bg);

  return card;
}
