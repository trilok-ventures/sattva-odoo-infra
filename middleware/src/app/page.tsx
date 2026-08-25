import { Chrome } from "./components/Chrome";
import { readPersonaFromCookie } from "./components/StubScreen";
import { SignInButtons } from "./components/SignInButtons";

export default async function Home() {
  const persona = await readPersonaFromCookie();

  return (
    <Chrome persona={persona} title="S1 · Sign in">
      <SignInButtons />
    </Chrome>
  );
}
