export const metadata = {
  title: "Contact — Trilok Ventures",
};

export default function ContactPage() {
  return (
    <section className="hero">
      <h1>Contact</h1>
      <p>
        For buyer or supplier inquiries, email{" "}
        <a href="mailto:hello@trilokventures.org">hello@trilokventures.org</a>{" "}
        and include your company name, role (buyer or supplier), and the
        products you work with.
      </p>
      <p>
        The online inquiry form lands with the Phase 3 deployment (see
        docs/superpowers/specs/2026-08-14-public-web-keycloak.md §2).
      </p>
    </section>
  );
}
