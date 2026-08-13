const mockMode = !process.env.KEYCLOAK_ISSUER;

export const metadata = {
  title: "Sign in — Trilok Ventures",
};

export default function SignInPage() {
  return (
    <section className="hero">
      <h1>Sign in</h1>
      <p>
        One Trilok ID opens the portal for employees, buyers, and suppliers.
      </p>

      {mockMode ? (
        <div
          className="card"
          style={{ maxWidth: 560, borderColor: "var(--amber)" }}
        >
          <h3>Development mock mode</h3>
          <p>
            KEYCLOAK_ISSUER is not configured, so this build cannot reach the
            identity provider. In production this page hands off to Keycloak
            (authorization code + PKCE) and routes you by persona
            (employee → dashboard, buyer → orders, supplier → documents).
          </p>
        </div>
      ) : (
        <p style={{ marginTop: 24 }}>
          <a className="button" href="/api/auth/login">
            Continue with Trilok ID
          </a>
        </p>
      )}
    </section>
  );
}
