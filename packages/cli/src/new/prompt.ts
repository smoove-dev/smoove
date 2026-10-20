import { cancel, isCancel, select, text } from "@clack/prompts";
import { UsageError } from "../commands.js";
import type { Values } from "../main.js";
import { DEFAULT_GROUP, DEFAULT_SECONDS, existingGroups, KEBAB, kebab } from "./new.js";

function answer<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("No composition made.");
    throw new UsageError("Canceled.");
  }
  return value;
}

/** Ask, in order, for what the flags left out: title, id, group, description, format, length. */
export async function promptNew(given: Values, root: string | null): Promise<Values> {
  const title = answer(
    await text({
      message: "What does the title card say?",
      placeholder: "Product launch",
      validate: (v) => (v?.trim() ? undefined : "Give it a title."),
    }),
  ).trim();

  const id =
    given.id ??
    answer(
      await text({
        message: "Its id (also the folder name)",
        initialValue: kebab(title),
        validate: (v) => (v && KEBAB.test(v) ? undefined : "Lowercase words joined by dashes."),
      }),
    );

  let group = given.group;
  if (group === undefined) {
    const groups = root ? existingGroups(root) : [];
    const NEW = "\0new";
    const picked =
      groups.length === 0
        ? NEW
        : answer(
            await select({
              message: "Which group in the sidebar?",
              options: [
                ...groups.map((g) => ({ value: g, label: g })),
                { value: NEW, label: "A new group" },
              ],
            }),
          );
    group =
      picked === NEW
        ? answer(await text({ message: "The group's name", initialValue: DEFAULT_GROUP })).trim() ||
          DEFAULT_GROUP
        : picked;
  }

  const description =
    given.description ??
    answer(await text({ message: "One line about it (optional)", defaultValue: "" }));

  const format =
    given.format ??
    answer(
      await select({
        message: "Format",
        options: [
          { value: "landscape", label: "Landscape, 1920 by 1080" },
          { value: "portrait", label: "Portrait, 1080 by 1920" },
          { value: "square", label: "Square, 1080 by 1080" },
        ],
      }),
    );

  const seconds =
    given.seconds ??
    answer(
      await text({
        message: "Length in seconds",
        initialValue: String(DEFAULT_SECONDS),
        validate: (v) => (Number(v) > 0 ? undefined : "A number above 0."),
      }),
    );

  return { title, id, group, description, format, seconds };
}
