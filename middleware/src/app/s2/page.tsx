import Link from "next/link";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import { Chrome } from "../components/Chrome";
import { readPersonaFromCookie } from "../components/StubScreen";
import { isEmployee } from "@/lib/persona";

export default async function S2Page() {
  const persona = await readPersonaFromCookie();

  return (
    <Chrome persona={persona} title="S2 · Role router">
      <h1>S2 · Role router</h1>
      <div>
        {isEmployee(persona) ? (
          <Link href={LANDING[persona]}>
            <div>Employee</div>
            <div>E1 Ops</div>
          </Link>
        ) : null}
        {persona === "buyer" ? (
          <Link href={SCREENS.B1}>
            <div>Buyer</div>
            <div>B1 Orders</div>
          </Link>
        ) : null}
        {persona === "supplier" ? (
          <Link href={SCREENS.P1}>
            <div>Seller</div>
            <div>P1 Home</div>
          </Link>
        ) : null}
      </div>
      <p>
        <a href={LANDING[persona]}>Home</a>
      </p>
    </Chrome>
  );
}
