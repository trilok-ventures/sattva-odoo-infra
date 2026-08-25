import type { LotState } from "./adapters/types";

export function officerReleased(state: LotState): boolean {
  return state === "available";
}

export function coaPresent(sha256: string | undefined): boolean {
  return typeof sha256 === "string" && /^[a-f0-9]{64}$/i.test(sha256);
}

export function saleStatusLabel(state: LotState): string {
  switch (state) {
    case "available":
      return "Released for sale";
    case "quarantine":
      return "Quarantine (not released)";
    case "rejected":
      return "Rejected";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function coaCompareLabel(coaPass: boolean): string {
  return coaPass ? "COA compare pass" : "COA compare fail";
}

export function truncateHash(sha256: string): string {
  if (!coaPresent(sha256)) return "none";
  return `${sha256.slice(0, 8)}…`;
}

export function releaseIndependenceNote(state: LotState): string {
  switch (state) {
    case "quarantine":
      return "Officer release is independent of COA compare. A compare pass in quarantine is not available-for-sale.";
    case "available":
      return "Officer released this lot. COA compare pass is a separate GREEN signal, not the release.";
    case "rejected":
      return "This lot is rejected. It is not available-for-sale.";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
