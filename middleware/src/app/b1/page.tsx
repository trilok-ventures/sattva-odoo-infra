import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function B1Page() {
  return <StubScreen title="B1 · Orders" path={SCREENS.B1} flow="buyer" />;
}
