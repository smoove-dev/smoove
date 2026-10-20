import config from "virtual:smoove/config";
import { Studio } from "@smoove/studio";
import { redirect, useNavigate } from "react-router";

/** No queue when smoove.config.ts turns rendering off. */
export function loader() {
  if (!config.render) throw redirect("/");
  return null;
}

/** The render queue as its own route. */
export default function Queue() {
  const navigate = useNavigate();
  return (
    <Studio.Main>
      <Studio.Header>
        <Studio.HeaderTitle icon="queue" title="Render Queue" sub="Server render pipeline" />
        <Studio.Spacer />
        <Studio.Button tone="ghost" icon="spark" onClick={() => navigate("/")}>
          Home
        </Studio.Button>
      </Studio.Header>
      <Studio.RenderQueue />
    </Studio.Main>
  );
}
