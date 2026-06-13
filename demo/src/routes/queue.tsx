import { Studio } from "@konva-motion/studio";
import { useNavigate } from "react-router";

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
