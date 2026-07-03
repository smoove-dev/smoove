import { parseArgs } from "node:util";

export const TEMPLATES = ["studio", "composition"] as const;
export type TemplateName = (typeof TEMPLATES)[number];

export interface CliOptions {
  template?: TemplateName;
  dir?: string;
  language?: "ts" | "js";
  install: boolean;
  git: boolean;
  /** undefined = ask interactively */
  skill?: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ts: { type: "boolean" },
      js: { type: "boolean" },
      "no-install": { type: "boolean" },
      "no-git": { type: "boolean" },
      "no-skill": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [templateArg, dirArg] = positionals;
  if (templateArg && !(TEMPLATES as readonly string[]).includes(templateArg)) {
    throw new Error(
      `Unknown template "${templateArg}". Available templates: ${TEMPLATES.join(", ")}.`,
    );
  }
  if (values.ts && values.js) {
    throw new Error("Pass either --ts or --js, not both.");
  }

  return {
    template: templateArg as TemplateName | undefined,
    dir: dirArg,
    language: values.ts ? "ts" : values.js ? "js" : undefined,
    install: !values["no-install"],
    git: !values["no-git"],
    skill: values["no-skill"] ? false : undefined,
    help: values.help ?? false,
  };
}
