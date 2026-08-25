import Link from "next/link";
import { adjacentLots } from "@/lib/lot-nav";
import type { LotGreen } from "@/lib/adapters/types";
import type { Persona } from "@/lib/persona";

export function LotPager({
  persona,
  lots,
  currentId,
}: {
  persona: Persona;
  lots: LotGreen[];
  currentId: string;
}) {
  const { prev, next } = adjacentLots(lots, currentId);
  return (
    <nav className="pager" aria-label="Lot pages">
      <Link className="btn" href={`/lots?persona=${persona}`}>
        Back to lots
      </Link>
      {prev ? (
        <Link className="btn" href={`/lots/${prev.id}?persona=${persona}`}>
          Previous {prev.id.toUpperCase()}
        </Link>
      ) : (
        <span className="btn disabled" aria-disabled="true">
          Previous
        </span>
      )}
      {next ? (
        <Link className="btn" href={`/lots/${next.id}?persona=${persona}`}>
          Next {next.id.toUpperCase()}
        </Link>
      ) : (
        <span className="btn disabled" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
