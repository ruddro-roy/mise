interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  exec(query: string): Promise<unknown>;
  prepare(query: string): D1PreparedStatement;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
