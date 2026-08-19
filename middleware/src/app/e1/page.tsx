import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function E1Page() {
  return <StubScreen title="E1 · Ops dashboard" path={SCREENS.E1} flow="employee" />;
}
