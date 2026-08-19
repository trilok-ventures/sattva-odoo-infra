import { StubScreen } from "../components/StubScreen";
import { SCREENS } from "@/lib/screen-graph";

export default function E3Page() {
  return (
    <StubScreen title="E3 · Supplier dossier — Example Foods Pvt Ltd" path={SCREENS.E3} flow="employee" />
  );
}
