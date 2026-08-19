import Link from "next/link";
import { LANDING, SCREENS } from "@/lib/screen-graph";
import { Chrome } from "../components/Chrome";
import { employeeLanding, readPersonaFromCookie } from "../components/StubScreen";

export default async function S2Page() {
  const persona = await readPersonaFromCookie();
  const employeeHref = employeeLanding(persona);

  return (
    <Chrome persona={persona} title="S2 · Role router">
      <h1>S2 · Role router</h1>
      <div>
        <Link href={employeeHref}>
          <div>Employee</div>
          <div>E1 Ops</div>
        </Link>
        <Link href={SCREENS.B1}>
          <div>Buyer</div>
          <div>B1 Orders</div>
        </Link>
        <Link href={SCREENS.P1}>
          <div>Seller</div>
          <div>P1 Home</div>
        </Link>
      </div>
      <p>
        <a href={LANDING[persona]}>Home</a>
      </p>
    </Chrome>
  );
}
