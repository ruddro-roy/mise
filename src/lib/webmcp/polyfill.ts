import type {
  ModelContext,
  RegisteredTool,
  RegisterToolOptions,
  ToolDefinition,
} from "./types";

type InternalTool = {
  definition: ToolDefinition;
  exposedTo: string[];
};

const POLYFILL_FLAG = "__webmcpPolyfill";

class ModelContextPolyfill extends EventTarget implements ModelContext {
  readonly [POLYFILL_FLAG] = true;
  #tools = new Map<string, InternalTool>();
  ontoolchange: ((event: Event) => void) | null = null;

  constructor() {
    super();
    this.addEventListener("toolchange", (event) => {
      this.ontoolchange?.(event);
    });
  }

  async registerTool(definition: ToolDefinition, options?: RegisterToolOptions): Promise<void> {
    if (options?.signal?.aborted) return;
    if (!definition.name || definition.name.length > 128) {
      throw new Error("Tool name must be 1–128 characters.");
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(definition.name)) {
      throw new Error("Tool name may only contain letters, numbers, _, -, and .");
    }

    this.#tools.set(definition.name, {
      definition,
      exposedTo: options?.exposedTo ?? [],
    });

    options?.signal?.addEventListener(
      "abort",
      () => {
        if (this.#tools.get(definition.name)?.definition === definition) {
          this.#tools.delete(definition.name);
          this.dispatchEvent(new Event("toolchange"));
        }
      },
      { once: true },
    );

    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(): Promise<RegisteredTool[]> {
    return [...this.#tools.values()]
      .map((tool) => this.#toRegistered(tool))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async executeTool(
    tool: RegisteredTool,
    argsJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    const internal = this.#tools.get(tool.name);
    if (!internal) {
      throw new Error(`Tool "${tool.name}" is not registered.`);
    }
    if (options?.signal?.aborted) {
      throw new DOMException("Tool execution aborted.", "AbortError");
    }

    let input: Record<string, unknown> = {};
    if (argsJson && argsJson.trim()) {
      const parsed = JSON.parse(argsJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        input = parsed as Record<string, unknown>;
      }
    }

    const result = await internal.definition.execute(input, { signal: options?.signal });
    if (result == null) return result;
    return typeof result === "string" ? result : JSON.stringify(result);
  }

  #toRegistered(tool: InternalTool): RegisteredTool {
    return {
      name: tool.definition.name,
      title: tool.definition.title ?? "",
      description: tool.definition.description,
      inputSchema: tool.definition.inputSchema ?? { type: "object", properties: {} },
      annotations: tool.definition.annotations ?? {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      origin: typeof location !== "undefined" ? location.origin : "https://localhost",
      window: typeof window !== "undefined" ? window : undefined,
    };
  }
}

export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  const existing = document.modelContext;
  if (existing && typeof existing.registerTool === "function") return existing;
  return null;
}

export function isNativeModelContext(): boolean {
  const ctx = getModelContext();
  if (!ctx) return false;
  return !(POLYFILL_FLAG in ctx);
}

export function subscribeToToolChanges(
  ctx: ModelContext,
  listener: EventListenerOrEventListenerObject,
): () => void {
  const add = ctx.addEventListener;
  const remove = ctx.removeEventListener;
  if (typeof add !== "function" || typeof remove !== "function") {
    return () => undefined;
  }

  add.call(ctx, "toolchange", listener);
  return () => remove.call(ctx, "toolchange", listener);
}

export function ensureModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  const existing = getModelContext();
  if (existing) return existing;
  const polyfill = new ModelContextPolyfill();
  Object.defineProperty(document, "modelContext", {
    value: polyfill,
    configurable: true,
    writable: true,
  });
  return polyfill;
}

export function createModelContextPolyfill(): ModelContext {
  return new ModelContextPolyfill();
}
