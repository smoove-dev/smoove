import { Studio } from "@smoove/studio";

/**
 * The index route renders whatever you want in the center — here a docs page.
 * Swap this for an MDX/markdown component, a dashboard, etc. Nothing about the
 * center is hard-coded in the studio; it's just the route's content.
 */
export default function Home() {
  return (
    <Studio.Main>
      <Studio.Header>
        <Studio.HeaderTitle icon="spark" title="SmooveStudio" sub="smoove studio" />
      </Studio.Header>

      <div className="smoove-doc-wrap scroll">
        <article className="smoove-doc">
          <h1>Welcome to the studio</h1>
          <p>
            This page lives at <code>/</code> and is just a normal route — the center region is
            whatever the matched route renders. Pick a composition from the left to open the stage,
            or jump to the render queue.
          </p>

          <h2>How it's wired</h2>
          <ul>
            <li>
              <code>layouts/studio-layout.tsx</code> holds the persistent shell (the{" "}
              <code>&lt;Studio&gt;</code> provider, the sidebar, and an <code>&lt;Outlet/&gt;</code>
              ).
            </li>
            <li>
              <code>/c/:id</code> renders the stage + timeline + inspector for a composition.
            </li>
            <li>
              <code>/queue</code> renders the render queue. Moving between them is plain navigation.
            </li>
          </ul>

          <h2>Composition is the config</h2>
          <p>
            There are no feature flags. Want to drop the zoom control? Don't render{" "}
            <code>&lt;Studio.Zoom/&gt;</code>. Want extra menu entries? Add{" "}
            <code>&lt;Studio.Menu.Item/&gt;</code>s. Want a different center? Add a route.
          </p>

          <pre>{`<Studio.Header>
  <Studio.Menu icon="dots">
    <Studio.Menu.Item onClick={...}>Render…</Studio.Menu.Item>
    <Studio.Menu.Item onClick={...}>My action</Studio.Menu.Item>
  </Studio.Menu>
</Studio.Header>`}</pre>
        </article>
      </div>
    </Studio.Main>
  );
}
