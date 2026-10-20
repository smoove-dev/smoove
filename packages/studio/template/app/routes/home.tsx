import config from "virtual:smoove/config";
import { Studio } from "@smoove/studio";

/** The index route: how a project works, for whoever opens the studio first. */
export default function Home() {
  return (
    <Studio.Main>
      <Studio.Header>
        <Studio.HeaderTitle icon="spark" title={config.name ?? "Smoove Studio"} sub="Home" />
      </Studio.Header>

      <div className="smoove-doc-wrap scroll">
        <article className="smoove-doc">
          <h1>Welcome to the studio</h1>
          <p>
            Pick a composition on the left to open it. Everything you write lives in the{" "}
            <code>compositions/</code> folder, one folder per composition.
          </p>

          <h2>Add a composition</h2>
          <p>Run this from the project folder, and answer a few questions:</p>
          <pre>npx smoove new</pre>
          <p>
            It writes a folder with a title card to start from. The studio picks it up as soon as
            the folder appears. A composition folder needs an <code>index.ts</code> that
            default-exports its entry: the id, the title, the group, and the composition itself.
          </p>

          <h2>Make it yours</h2>
          <p>
            <code>smoove.config.ts</code> sets the name, the logo, and the accent color of this
            studio, and can turn rendering off. Your editor lists the options as you type.
          </p>
          <pre>{`export default defineConfig({
  name: "Acme Videos",
  primaryColor: "#15cda8",
});`}</pre>

          <h2>Change the studio itself</h2>
          <p>
            The studio app ships inside <code>@smoove/studio</code> and updates with it. To change
            its pages, its layout, or its routes, copy the whole app into your project:
          </p>
          <pre>npx smoove studio detach</pre>
          <p>
            That's one-way: from then on the project owns the app, and studio updates no longer
            reach it.
          </p>
        </article>
      </div>
    </Studio.Main>
  );
}
