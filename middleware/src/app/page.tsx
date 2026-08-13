export default function Home() {
  return (
    <main>
      <h1>Sattva Middleware Portal</h1>
      <p>
        Operations BFF (GREEN edge). Fabric calls stay on the server. Default
        FABRIC_MODE=mock. Live mode returns 401 on /api (except health) until
        Keycloak. HTML twin stays on a separate Vercel project:
        https://sattva-odoo-infra.vercel.app/
      </p>
      <p>
        Health: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
