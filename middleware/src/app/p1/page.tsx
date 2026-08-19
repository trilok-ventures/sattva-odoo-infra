import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function P1Page() {
  return <StubScreen title="P1 · Seller home" path={SCREENS.P1} flow="seller" />;
}
