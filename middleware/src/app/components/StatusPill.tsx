export type PillStatus = "pending" | "review" | "approved" | "blocked";

export function StatusPill({ status }: { status: PillStatus }) {
  return <span className={`pill pill-${status}`}>{status}</span>;
}
