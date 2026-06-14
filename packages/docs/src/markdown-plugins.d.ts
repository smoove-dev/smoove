// Minimal ambient types for markdown-it plugins that don't ship their own.
// Kept self-contained to avoid the @types/markdown-it version split between
// plugins (container pins <14, anchor pins 14). `md` is left as `unknown` since
// it's only passed straight to markdown-it's `.use()`.
declare module "markdown-it-kbd" {
  const plugin: (md: unknown, opts?: unknown) => void;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  const plugin: (
    md: unknown,
    opts?: { enabled?: boolean; label?: boolean; labelAfter?: boolean },
  ) => void;
  export default plugin;
}
