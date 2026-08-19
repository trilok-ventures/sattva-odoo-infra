import { StubScreen } from "../../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function B2Page() {
  return <StubScreen title="B2 · Order detail SO-1042" path={SCREENS.B2} flow="buyer" />;
}
