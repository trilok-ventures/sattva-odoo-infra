import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trilok Ventures",
  description:
    "Trilok Ventures — holding company for compliance-assured food ingredient businesses. Sattva Brokers: CFIA-compliant dehydrated spice brokerage from verified Indian manufacturers to Canadian processors.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <a className="brand" href="/">
              TRILOK VENTURES
            </a>
            <div className="links">
              <a href="/sattva">Sattva Brokers</a>
              <a href="/contact">Contact</a>
              <a href="/signin" className="button">
                Sign in
              </a>
            </div>
          </nav>
          {children}
          <footer className="footer">
            © {new Date().getFullYear()} Trilok Ventures. Sattva Brokers is an
            operating company of Trilok Ventures.
          </footer>
        </div>
      </body>
    </html>
  );
}
