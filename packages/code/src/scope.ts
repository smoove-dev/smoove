/**
 * A single change atom: the `before` text morphs into the `after` text as the
 * owning scope's progress moves 0 to 1. An unchanged run of code is stored as a
 * plain string tag instead.
 */
export interface CodeFragment {
  before: string;
  after: string;
}

/**
 * A group of fragments sharing one progress value. Scopes nest, so independent
 * edits can each carry their own progress.
 */
export interface CodeScope {
  progress: number;
  fragments: CodeTag[];
}

export type CodeTag = string | CodeFragment | CodeScope;

export type PossibleCodeScope = CodeScope | CodeTag[] | string;

/** Selects which side of each fragment to emit when resolving to a string. */
export type IsAfter = boolean | ((scope: CodeScope) => boolean);

export function isCodeScope(value: unknown): value is CodeScope {
  return (
    typeof value === "object" && value !== null && Array.isArray((value as CodeScope).fragments)
  );
}

export function isCodeFragment(value: unknown): value is CodeFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CodeFragment).before === "string" &&
    typeof (value as CodeFragment).after === "string"
  );
}

export function parseCodeScope(value: PossibleCodeScope): CodeScope {
  if (typeof value === "string") {
    return { progress: 0, fragments: [value] };
  }
  if (Array.isArray(value)) {
    return { progress: 0, fragments: value };
  }
  return value;
}

export function resolveScope(scope: CodeScope, isAfter: IsAfter): string {
  const after = typeof isAfter === "boolean" ? isAfter : isAfter(scope);
  let code = "";
  for (const tag of scope.fragments) {
    code += resolveCodeTag(tag, after, isAfter);
  }
  return code;
}

export function resolveCodeTag(tag: CodeTag, after: boolean, isAfter: IsAfter = after): string {
  if (typeof tag === "string") {
    return tag;
  }
  if (isCodeScope(tag)) {
    return resolveScope(tag, isAfter);
  }
  return after ? tag.after : tag.before;
}
