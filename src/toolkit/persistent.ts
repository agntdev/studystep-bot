import type { StorageAdapter } from "grammy";

/**
 * Named durable records for domain data. This deliberately exposes no list-all
 * operation: callers maintain and read explicit index records instead.
 */
export class PersistentStore<S extends object = object> {
  constructor(private readonly storage: StorageAdapter<S>) {}

  private key(key: string): string {
    return `domain:${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.storage.read(this.key(key))) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await this.storage.write(this.key(key), value as unknown as S);
  }
}
