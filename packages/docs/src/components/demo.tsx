import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { useState } from "react";

// Live-demo embed: plays a composition in <km-player> and, when given the
// module's raw `source`, offers a "View source" toggle that reveals it in a
// runtime-highlighted code block. MDX passes both the `?url` (for the player)
// and `?raw` (for the source) imports of the same composition module.
export function Demo({
  src,
  source,
  lang = "ts",
  label,
}: {
  src: string;
  source?: string;
  lang?: string;
  label?: string;
}) {
  const [showSource, setShowSource] = useState(false);

  return (
    <figure className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <figcaption className="flex items-center gap-2 border-fd-border border-b px-4 py-2 text-fd-muted-foreground text-xs">
        <span className="inline-block size-1.5 rounded-full bg-fd-primary" aria-hidden="true" />
        <span className="font-medium">Live demo</span>
        <span className="ml-auto flex items-center gap-3">
          {label ? <span className="opacity-70">{label}</span> : null}
          {source ? (
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              aria-expanded={showSource}
              className="rounded-md px-2 py-1 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              {showSource ? "Hide source" : "View source"}
            </button>
          ) : null}
        </span>
      </figcaption>

      <div className="grid aspect-video w-full place-items-center bg-fd-secondary [&_km-player]:size-full">
        <km-player src={src} controls loop autoplay />
      </div>

      {source && showSource ? (
        <div className="border-fd-border border-t [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-x-0 [&_figure]:border-b-0">
          <DynamicCodeBlock lang={lang} code={source} />
        </div>
      ) : null}
    </figure>
  );
}
