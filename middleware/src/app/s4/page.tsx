import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function S4Page() {
  return <StubScreen title="S4 · Profile" path={SCREENS.S4} flow="employee" />;
}
