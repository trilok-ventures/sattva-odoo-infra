export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Compliance-assured food ingredient trade, built on systems.</h1>
        <p>
          Trilok Ventures owns and operates businesses that move documented,
          traceable food ingredients from verified manufacturers to processors
          — with preventive-control evidence behind every lot.
        </p>
      </section>

      <section className="section">
        <h2>Our operating company</h2>
        <div className="cards">
          <div className="card">
            <h3>Sattva Brokers</h3>
            <p>
              CFIA-compliant import brokerage for dehydrated spices — onion,
              garlic, and allied vegetables — from verified Indian
              manufacturers to Canadian food processors, wholesalers, and
              copackers.
            </p>
            <p style={{ marginTop: 16 }}>
              <a href="/sattva">Explore Sattva Brokers</a>
            </p>
          </div>
          <div className="card">
            <h3>How we work</h3>
            <p>
              Supplier vetting against Preventive Control Plans, HACCP and BRC
              evidence, lot-level traceability, and CFIA clearance
              coordination — value is documentation accuracy, not inventory.
            </p>
          </div>
          <div className="card">
            <h3>Governance</h3>
            <p>
              Trilok Ventures is the holding company. Operating liability and
              customer contracts live in the operating companies; software and
              brand are held separately and licensed in.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Work with us</h2>
        <p style={{ color: "var(--muted)", maxWidth: 640 }}>
          Buyers and suppliers onboard through our compliance process. If you
          already have an account, sign in to your portal.
        </p>
        <p style={{ marginTop: 24, display: "flex", gap: 16 }}>
          <a className="button" href="/contact">
            Start an inquiry
          </a>
          <a
            className="button"
            href="/signin"
            style={{ background: "var(--blue)" }}
          >
            Sign in
          </a>
        </p>
      </section>
    </>
  );
}
