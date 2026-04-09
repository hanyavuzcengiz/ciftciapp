export interface IdempotencyStore {
  remember(key: string): boolean;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>();

  remember(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}
