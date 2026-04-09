export interface IdempotencyStore {
  remember(key: string): boolean;
}

export type IdempotencyReplayRecord = {
  fingerprint: string;
  statusCode: number;
  body: unknown;
};

export type IdempotencyReplayProbeResult =
  | { kind: "missing" }
  | { kind: "replay"; record: IdempotencyReplayRecord }
  | { kind: "conflict"; record: IdempotencyReplayRecord };

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>();

  remember(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

export class InMemoryIdempotencyReplayStore {
  private readonly records = new Map<string, IdempotencyReplayRecord>();

  probe(key: string, fingerprint: string): IdempotencyReplayProbeResult {
    const existing = this.records.get(key);
    if (!existing) return { kind: "missing" };
    if (existing.fingerprint === fingerprint) {
      return { kind: "replay", record: existing };
    }
    return { kind: "conflict", record: existing };
  }

  remember(key: string, record: IdempotencyReplayRecord): void {
    this.records.set(key, record);
  }
}
