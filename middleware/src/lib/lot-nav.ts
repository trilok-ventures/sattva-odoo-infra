import type { LotGreen } from "./adapters/types";

export function adjacentLots(lots: LotGreen[], id: string) {
  const index = lots.findIndex((lot) => lot.id === id);
  return {
    index,
    prev: index > 0 ? lots[index - 1] : null,
    next: index >= 0 && index < lots.length - 1 ? lots[index + 1] : null,
  };
}
