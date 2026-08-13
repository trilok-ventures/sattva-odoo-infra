import redKeys from "./red-keys.json";

const RED = new Set(
  (Array.isArray(redKeys) ? redKeys : []).map((k: string) => k.toLowerCase()),
);

export function isRedKey(key: string): boolean {
  return RED.has(key.toLowerCase());
}

export function stripRedKeys<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strip);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isRedKey(key)) continue;
      out[key] = strip(child);
    }
    return out;
  }
  return value;
}

export function assertNoRedKeys(value: unknown, trail = "$"): string[] {
  const hits: string[] = [];
  walk(value, trail, hits);
  return hits;
}

function walk(value: unknown, trail: string, hits: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${trail}[${i}]`, hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = `${trail}.${key}`;
      if (isRedKey(key)) hits.push(next);
      walk(child, next, hits);
    }
  }
}
