export const metadata = {
  title: "Sattva Brokers — Trilok Ventures",
};

export default function SattvaPage() {
  return (
    <>
      <section className="hero">
        <h1>Sattva Brokers</h1>
        <p>
          A CFIA-compliant import brokerage for dehydrated spices and allied
          ingredients. Product moves from verified Indian manufacturers to
          Canadian food businesses — every lot backed by preventive-control
          evidence.
        </p>
      </section>

      <section className="section">
        <h2>What we broker</h2>
        <div className="cards">
          <div className="card">
            <h3>Dehydrated onion</h3>
            <p>Flakes, granules, and powder with documented moisture and mesh specifications.</p>
          </div>
          <div className="card">
            <h3>Dehydrated garlic</h3>
            <p>Cloves, granules, and powder from audited dehydration facilities.</p>
          </div>
          <div className="card">
            <h3>Allied vegetables</h3>
            <p>Related dehydrated vegetables for processors, wholesalers, and copackers.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Compliance first</h2>
        <div className="cards">
          <div className="card">
            <h3>Supplier gates</h3>
            <p>
              No supplier becomes purchasable until a compliance officer
              approves their Preventive Control Plan evidence — HACCP, BRC,
              sanitation audits.
            </p>
          </div>
          <div className="card">
            <h3>Lot verification</h3>
            <p>
              Every sellable lot carries a hashed certificate of analysis,
              verified against spec before release. Quarantine is the default.
            </p>
          </div>
          <div className="card">
            <h3>7-year dossier</h3>
            <p>
              PCP evidence, COAs, and traceability records are retained for
              seven years in a secured vault.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Get started</h2>
        <p style={{ color: "var(--muted)", maxWidth: 640 }}>
          We onboard a small number of buyers and suppliers each quarter to
          keep verification quality high.
        </p>
        <p style={{ marginTop: 24 }}>
          <a className="button" href="/contact">
            Contact Sattva Brokers
          </a>
        </p>
      </section>
    </>
  );
}
