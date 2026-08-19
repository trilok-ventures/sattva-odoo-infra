import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function E2Page() {
  return <StubScreen title="E2 · Compliance review queue" path={SCREENS.E2} flow="employee" />;
}
