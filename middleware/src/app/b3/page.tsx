import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function B3Page() {
  return <StubScreen title="B3 · Quotes & contracts" path={SCREENS.B3} flow="buyer" />;
}
