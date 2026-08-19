import { Chrome, PERSONA_LABELS } from "../components/Chrome";
import { SignOutButton } from "../components/SignOutButton";
import { readPersonaFromCookie } from "../components/StubScreen";

export default async function S4Page() {
  const persona = await readPersonaFromCookie();

  return (
    <Chrome persona={persona} title="S4 · Profile">
      <h1>S4 · Profile</h1>
      <p>
        Persona: <strong>{PERSONA_LABELS[persona]}</strong>
      </p>
      <p className="caption">No self-service role edit. Groups are visible for audit only.</p>
      <SignOutButton />
    </Chrome>
  );
}
