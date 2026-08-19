import { StubScreen } from "../../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function P2ReceiptPage() {
  return <StubScreen title="P2R · Upload receipt" path={SCREENS.P2R} flow="seller" />;
}
