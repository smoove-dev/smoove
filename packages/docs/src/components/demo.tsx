export function Demo({ src, label }: { src: string; label?: string }) {
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <figcaption className="flex items-center gap-2 border-fd-border border-b px-4 py-2 text-fd-muted-foreground text-xs">
        <span className="inline-block size-1.5 rounded-full bg-fd-primary" aria-hidden="true" />
        <span className="font-medium">Live demo</span>
        {label ? <span className="ml-auto opacity-70">{label}</span> : null}
      </figcaption>
      <div className="grid aspect-video w-full place-items-center bg-fd-secondary [&_km-player]:size-full">
        <km-player src={src} controls loop autoplay />
      </div>
    </figure>
  );
}
